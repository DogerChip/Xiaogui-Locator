class XiaoguiLocator {
    constructor() {
        this.currentPosition = null;
        this.markers = this.loadMarkers();
        this.folders = this.loadFolders();
        this.editingMarkerId = null;
        this.deletingMarkerId = null;
        this.movingMarkerId = null;
        this.lastMarkerTime = null;
        this.map = null;
        this.currentMarker = null;
        this.markerLayers = [];
        this.timeUpdateInterval = null;
        this.init();
    }

    init() {
        this.initMap();
        this.setupEventListeners();
        this.getCurrentLocation();
        this.renderFolders();
        this.renderMarkers();
        this.updateLastRecord();
        this.startTimeUpdate();
    }

    initMap() {
        this.map = L.map('map', {
            center: [35.8617, 104.1954],
            zoom: 5,
            zoomControl: true,
            scrollWheelZoom: true,
            touchZoom: true,
            doubleClickZoom: true,
            dragging: true,
            maxZoom: 18,
            minZoom: 3
        }).setView([35.8617, 104.1954], 5);

        L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            subdomains: '1234',
            attribution: '© 高德地图'
        }).addTo(this.map);

        this.map.zoomControl.setPosition('bottomright');
    }

    updateMap() {
        if (!this.map) return;

        if (this.markerLayers.length > 0) {
            this.markerLayers.forEach(layer => {
                this.map.removeLayer(layer);
            });
            this.markerLayers = [];
        }

        this.markers.forEach(marker => {
            const markerLayer = L.marker([marker.latitude, marker.longitude], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="width: 20px; height: 20px; background: #667eea; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.5);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(this.map);

            const time = new Date(marker.createdAt).toLocaleString('zh-CN');
            markerLayer.bindPopup(`<b>${marker.name}</b><br>📍 ${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}<br>⏰ ${time}`);

            this.markerLayers.push(markerLayer);
        });

        if (this.currentPosition) {
            if (this.currentMarker) {
                this.map.removeLayer(this.currentMarker);
            }

            this.currentMarker = L.marker([this.currentPosition.latitude, this.currentPosition.longitude], {
                icon: L.divIcon({
                    className: 'custom-current-marker',
                    html: '<div style="width: 24px; height: 24px; background: #28a745; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 6px rgba(40, 167, 69, 0.3), 0 2px 8px rgba(0,0,0,0.2); animation: pulse 2s infinite;"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.map);

            this.currentMarker.bindPopup(`<b>📍 当前位置</b><br>纬度: ${this.currentPosition.latitude.toFixed(6)}<br>经度: ${this.currentPosition.longitude.toFixed(6)}<br>精度: ${this.currentPosition.accuracy}m`);
        }
    }

    setupEventListeners() {
        document.getElementById('markButton').addEventListener('click', () => this.markCurrentLocation());
        document.getElementById('createFolderBtn').addEventListener('click', () => this.openCreateFolderModal());
        
        document.getElementById('modalClose').addEventListener('click', () => this.closeRenameModal());
        document.getElementById('btnCancel').addEventListener('click', () => this.closeRenameModal());
        document.getElementById('btnConfirm').addEventListener('click', () => this.confirmRename());
        
        document.getElementById('deleteModalClose').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('btnDeleteCancel').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('btnDeleteConfirm').addEventListener('click', () => this.confirmDelete());

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeRenameModal();
            }
        });

        document.getElementById('deleteModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('deleteModalOverlay')) {
                this.closeDeleteModal();
            }
        });
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            document.getElementById('currentLocation').innerHTML = 
                '<div class="error-text">❌ 您的浏览器不支持地理定位</div>' +
                '<button id="manualLocationBtn" class="manual-btn">📍 手动输入坐标</button>';
            document.getElementById('manualLocationBtn').addEventListener('click', () => this.openManualLocationModal());
            return;
        }

        navigator.geolocation.watchPosition(
            (position) => {
                const gcjCoords = this.wgs84ToGcj02(position.coords.latitude, position.coords.longitude);
                this.currentPosition = {
                    latitude: gcjCoords.lat,
                    longitude: gcjCoords.lng,
                    accuracy: position.coords.accuracy,
                    originalLat: position.coords.latitude,
                    originalLng: position.coords.longitude
                };
                this.updateLocationDisplay();
            },
            (error) => {
                this.handleLocationError(error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 30000
            }
        );
    }

    handleLocationError(error) {
        const errorMessages = {
            1: '🔒 位置权限被拒绝',
            2: '📍 无法获取位置信息',
            3: '⏱️ 获取位置超时'
        };
        
        const solutions = {
            1: '请在浏览器设置中开启位置权限，或尝试手动输入坐标',
            2: '请确保手机已开启定位服务，或尝试手动输入坐标',
            3: '定位时间过长，请重试或手动输入坐标'
        };

        document.getElementById('currentLocation').innerHTML = 
            `<div class="error-text">${errorMessages[error.code] || '❌ 未知错误'}</div>` +
            `<div class="error-hint">${solutions[error.code] || '请检查定位设置'}</div>` +
            '<button id="retryLocationBtn" class="retry-btn">🔄 重新获取位置</button>' +
            '<button id="manualLocationBtn" class="manual-btn">📍 手动输入坐标</button>';

        document.getElementById('retryLocationBtn').addEventListener('click', () => this.getCurrentLocation());
        document.getElementById('manualLocationBtn').addEventListener('click', () => this.openManualLocationModal());
    }

    openManualLocationModal() {
        const modalHtml = `
            <div class="modal-overlay" id="manualModalOverlay" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h4>📍 手动输入坐标</h4>
                        <button class="modal-close" id="manualModalClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="manualLat" placeholder="纬度 (如: 35.8617)">
                        <input type="text" id="manualLng" placeholder="经度 (如: 104.1954)">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" id="btnManualCancel">取消</button>
                        <button class="btn btn-confirm" id="btnManualConfirm">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('manualModalClose').addEventListener('click', () => this.closeManualLocationModal());
        document.getElementById('btnManualCancel').addEventListener('click', () => this.closeManualLocationModal());
        document.getElementById('btnManualConfirm').addEventListener('click', () => this.confirmManualLocation());

        document.getElementById('manualModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('manualModalOverlay')) {
                this.closeManualLocationModal();
            }
        });
    }

    closeManualLocationModal() {
        document.getElementById('manualModalOverlay').remove();
    }

    confirmManualLocation() {
        const lat = parseFloat(document.getElementById('manualLat').value);
        const lng = parseFloat(document.getElementById('manualLng').value);

        if (isNaN(lat) || isNaN(lng)) {
            alert('请输入有效的坐标');
            return;
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            alert('请输入有效的坐标范围\n纬度: -90 至 90\n经度: -180 至 180');
            return;
        }

        this.currentPosition = {
            latitude: lat,
            longitude: lng,
            accuracy: 0
        };

        this.updateLocationDisplay();
        this.closeManualLocationModal();
        alert('✅ 位置已设置');
    }

    updateLocationDisplay() {
        if (!this.currentPosition) return;
        
        const lat = this.currentPosition.latitude.toFixed(6);
        const lng = this.currentPosition.longitude.toFixed(6);
        
        document.getElementById('currentLocation').innerHTML = 
            `<div class="location-name">📍 定位成功</div>`;
        document.getElementById('currentCoords').innerHTML = 
            `<div class="coord-item">纬度: ${lat}</div>
             <div class="coord-item">经度: ${lng}</div>
             <div class="coord-item">精度: ${this.currentPosition.accuracy}m</div>`;
        
        this.updateMap();
    }

    markCurrentLocation() {
        if (!this.currentPosition) {
            alert('请先获取位置信息');
            return;
        }

        const newMarker = {
            id: Date.now(),
            name: `标记 ${this.markers.length + 1}`,
            latitude: this.currentPosition.latitude,
            longitude: this.currentPosition.longitude,
            accuracy: this.currentPosition.accuracy,
            createdAt: new Date().toISOString()
        };

        this.markers.push(newMarker);
        this.saveMarkers();
        this.renderMarkers();
        this.updateLastRecord();
        this.updateMap();
        
        this.lastMarkerTime = new Date();
        
        alert('✅ 位置标记成功！');
    }

    renderMarkers() {
        const container = document.getElementById('markersList');
        
        if (this.markers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗺️</div>
                    <p>暂无标记</p>
                    <p class="empty-hint">点击上方按钮记录您的位置</p>
                </div>
            `;
            document.getElementById('markerCount').textContent = '0';
            return;
        }

        const sortedMarkers = [...this.markers].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        container.innerHTML = sortedMarkers.map(marker => {
            const time = this.formatTime(new Date(marker.createdAt));
            const folder = marker.folderId ? this.folders.find(f => parseInt(f.id) === parseInt(marker.folderId)) : null;
            const folderName = folder ? folder.name : '未分类';
            return `
                <div class="marker-card" data-id="${marker.id}">
                    <div class="marker-header">
                        <span class="marker-name">${marker.name}</span>
                        <span class="marker-time">${time}</span>
                    </div>
                    <div class="marker-folder">📁 ${folderName}</div>
                    <div class="marker-coords">
                        <span>📍 ${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}</span>
                    </div>
                    <div class="marker-actions">
                        <button class="action-btn edit-btn" data-id="${marker.id}">✏️ 重命名</button>
                        <button class="action-btn move-btn" data-id="${marker.id}">📁 移动</button>
                        <button class="action-btn delete-btn" data-id="${marker.id}">🗑️ 删除</button>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('markerCount').textContent = this.markers.length;

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.openRenameModal(id);
            });
        });

        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.openMoveModal(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.openDeleteModal(id);
            });
        });
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return date.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    openRenameModal(id) {
        const marker = this.markers.find(m => m.id === id);
        if (!marker) return;

        this.editingMarkerId = id;
        document.getElementById('markerNameInput').value = marker.name;
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('markerNameInput').focus();
    }

    closeRenameModal() {
        document.getElementById('modalOverlay').style.display = 'none';
        this.editingMarkerId = null;
        document.getElementById('markerNameInput').value = '';
    }

    confirmRename() {
        const name = document.getElementById('markerNameInput').value.trim();
        if (!name) {
            alert('请输入标记名称');
            return;
        }

        const marker = this.markers.find(m => m.id === this.editingMarkerId);
        if (marker) {
            marker.name = name;
            this.saveMarkers();
            this.renderMarkers();
            this.updateLastRecord();
            this.updateMap();
        }

        this.closeRenameModal();
    }

    openDeleteModal(id) {
        this.deletingMarkerId = id;
        document.getElementById('deleteModalOverlay').style.display = 'flex';
    }

    closeDeleteModal() {
        document.getElementById('deleteModalOverlay').style.display = 'none';
        this.deletingMarkerId = null;
    }

    confirmDelete() {
        this.markers = this.markers.filter(m => m.id !== this.deletingMarkerId);
        this.saveMarkers();
        this.renderMarkers();
        this.updateLastRecord();
        this.updateMap();
        this.closeDeleteModal();
        alert('✅ 标记已删除');
    }

    updateLastRecord() {
        if (this.markers.length === 0) {
            document.getElementById('lastRecordSection').style.display = 'none';
            return;
        }

        const sortedMarkers = [...this.markers].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        const lastMarker = sortedMarkers[0];
        const lastDate = new Date(lastMarker.createdAt);
        const now = new Date();
        const diff = now - lastDate;

        let intervalText = '';
        if (diff < 60000) {
            intervalText = '刚刚';
        } else if (diff < 3600000) {
            intervalText = `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            intervalText = `${Math.floor(diff / 3600000)}小时前`;
        } else if (diff < 604800000) {
            intervalText = `${Math.floor(diff / 86400000)}天前`;
        } else {
            intervalText = `${Math.floor(diff / 604800000)}周前`;
        }

        document.getElementById('timeInterval').textContent = intervalText;
        document.getElementById('lastRecordSection').style.display = 'block';
    }

    saveMarkers() {
        localStorage.setItem('xiaoguiLocatorMarkers', JSON.stringify(this.markers));
    }

    loadMarkers() {
        const saved = localStorage.getItem('xiaoguiLocatorMarkers');
        return saved ? JSON.parse(saved) : [];
    }

    saveFolders() {
        localStorage.setItem('xiaoguiLocatorFolders', JSON.stringify(this.folders));
    }

    loadFolders() {
        const saved = localStorage.getItem('xiaoguiLocatorFolders');
        return saved ? JSON.parse(saved) : [];
    }

    createFolder(name) {
        const newFolder = {
            id: Date.now(),
            name: name,
            color: this.getRandomColor(),
            createdAt: new Date().toISOString()
        };
        this.folders.push(newFolder);
        this.saveFolders();
        this.renderFolders();
        return newFolder;
    }

    deleteFolder(folderId) {
        this.markers.forEach(marker => {
            if (marker.folderId && parseInt(marker.folderId) === parseInt(folderId)) {
                marker.folderId = null;
            }
        });
        this.folders = this.folders.filter(f => parseInt(f.id) !== parseInt(folderId));
        this.saveFolders();
        this.saveMarkers();
        this.renderFolders();
        this.renderMarkers();
    }

    renameFolder(folderId, newName) {
        const folder = this.folders.find(f => parseInt(f.id) === parseInt(folderId));
        if (folder) {
            folder.name = newName;
            this.saveFolders();
            this.renderFolders();
            this.renderMarkers();
        }
    }

    getRandomColor() {
        const colors = ['#667eea', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    moveMarkerToFolder(markerId, folderId) {
        const marker = this.markers.find(m => m.id === markerId);
        if (marker) {
            marker.folderId = folderId === 'none' ? null : parseInt(folderId);
            this.saveMarkers();
            this.renderMarkers();
        }
        this.closeMoveModal();
    }

    startTimeUpdate() {
        // 每30秒更新一次时间显示
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        this.timeUpdateInterval = setInterval(() => {
            this.updateLastRecord();
        }, 30000);
    }

    renderFolders() {
        const container = document.getElementById('foldersContainer');
        if (!container) return;

        if (this.folders.length === 0) {
            container.innerHTML = `
                <div class="empty-folders">
                    <span class="empty-folders-text">暂无文件夹</span>
                </div>
            `;
            return;
        }

        container.innerHTML = this.folders.map(folder => {
            const count = this.markers.filter(m => m.folderId && parseInt(m.folderId) === parseInt(folder.id)).length;
            return `
                <div class="folder-item" data-id="${folder.id}">
                    <div class="folder-color" style="background-color: ${folder.color}"></div>
                    <span class="folder-name">${folder.name}</span>
                    <span class="folder-count">${count}</span>
                    <div class="folder-actions">
                        <button class="folder-edit-btn" data-id="${folder.id}">✏️</button>
                        <button class="folder-delete-btn" data-id="${folder.id}">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.folder-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.openRenameFolderModal(id);
            });
        });

        document.querySelectorAll('.folder-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm('确定要删除这个文件夹吗？文件夹中的标记将被移到未分类。')) {
                    this.deleteFolder(id);
                }
            });
        });
    }

    openMoveModal(id) {
        const marker = this.markers.find(m => m.id === id);
        if (!marker) {
            console.log('Marker not found:', id);
            return;
        }

        this.movingMarkerId = id;
        console.log('Opening move modal for marker:', id, 'current folderId:', marker.folderId);
        console.log('Available folders:', this.folders);
        
        const folderOptions = this.folders.map(folder => {
            const isSelected = marker.folderId && parseInt(marker.folderId) === parseInt(folder.id);
            console.log(`Folder ${folder.name} (${folder.id}): selected=${isSelected}`);
            return `<option value="${folder.id}" ${isSelected ? 'selected' : ''}>${folder.name}</option>`;
        }).join('');

        const modalHtml = `
            <div class="modal-overlay" id="moveModalOverlay" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h4>📁 移动到文件夹</h4>
                        <button class="modal-close" id="moveModalClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <select id="folderSelect">
                            <option value="none" ${!marker.folderId ? 'selected' : ''}>未分类</option>
                            ${folderOptions}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" id="btnMoveCancel">取消</button>
                        <button class="btn btn-confirm" id="btnMoveConfirm">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('moveModalClose').addEventListener('click', () => this.closeMoveModal());
        document.getElementById('btnMoveCancel').addEventListener('click', () => this.closeMoveModal());
        document.getElementById('btnMoveConfirm').addEventListener('click', () => {
            const folderId = document.getElementById('folderSelect').value;
            this.moveMarkerToFolder(id, folderId);
        });

        document.getElementById('moveModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('moveModalOverlay')) {
                this.closeMoveModal();
            }
        });
    }

    closeMoveModal() {
        const overlay = document.getElementById('moveModalOverlay');
        if (overlay) overlay.remove();
        this.movingMarkerId = null;
    }

    openRenameFolderModal(id) {
        const folder = this.folders.find(f => parseInt(f.id) === parseInt(id));
        if (!folder) return;

        const modalHtml = `
            <div class="modal-overlay" id="renameFolderModalOverlay" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h4>✏️ 重命名文件夹</h4>
                        <button class="modal-close" id="renameFolderModalClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="folderNameInput" placeholder="输入文件夹名称" value="${folder.name}">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" id="btnRenameFolderCancel">取消</button>
                        <button class="btn btn-confirm" id="btnRenameFolderConfirm">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('renameFolderModalClose').addEventListener('click', () => this.closeRenameFolderModal());
        document.getElementById('btnRenameFolderCancel').addEventListener('click', () => this.closeRenameFolderModal());
        document.getElementById('btnRenameFolderConfirm').addEventListener('click', () => {
            const name = document.getElementById('folderNameInput').value.trim();
            if (name) {
                this.renameFolder(id, name);
                this.closeRenameFolderModal();
            } else {
                alert('请输入文件夹名称');
            }
        });

        document.getElementById('renameFolderModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('renameFolderModalOverlay')) {
                this.closeRenameFolderModal();
            }
        });
    }

    closeRenameFolderModal() {
        const overlay = document.getElementById('renameFolderModalOverlay');
        if (overlay) overlay.remove();
    }

    openCreateFolderModal() {
        const modalHtml = `
            <div class="modal-overlay" id="createFolderModalOverlay" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h4>📁 创建文件夹</h4>
                        <button class="modal-close" id="createFolderModalClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="newFolderNameInput" placeholder="输入文件夹名称">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-cancel" id="btnCreateFolderCancel">取消</button>
                        <button class="btn btn-confirm" id="btnCreateFolderConfirm">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('createFolderModalClose').addEventListener('click', () => this.closeCreateFolderModal());
        document.getElementById('btnCreateFolderCancel').addEventListener('click', () => this.closeCreateFolderModal());
        document.getElementById('btnCreateFolderConfirm').addEventListener('click', () => {
            const name = document.getElementById('newFolderNameInput').value.trim();
            if (name) {
                this.createFolder(name);
                this.closeCreateFolderModal();
                alert('✅ 文件夹创建成功！');
            } else {
                alert('请输入文件夹名称');
            }
        });

        document.getElementById('createFolderModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('createFolderModalOverlay')) {
                this.closeCreateFolderModal();
            }
        });
    }

    closeCreateFolderModal() {
        const overlay = document.getElementById('createFolderModalOverlay');
        if (overlay) overlay.remove();
    }

    wgs84ToGcj02(lat, lng) {
        const PI = Math.PI;
        const a = 6378137.0;
        const ee = 0.00669342162296594323;
        
        if (this.outOfChina(lat, lng)) {
            return { lat: lat, lng: lng };
        }
        
        let dLat = this.transformLat(lng - 105.0, lat - 35.0);
        let dLng = this.transformLng(lng - 105.0, lat - 35.0);
        const radLat = lat / 180.0 * PI;
        let magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        const sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
        dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
        
        return {
            lat: lat + dLat,
            lng: lng + dLng
        };
    }

    outOfChina(lat, lng) {
        return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
    }

    transformLat(x, y) {
        let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    transformLng(x, y) {
        let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new XiaoguiLocator();
});