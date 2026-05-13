class XiaoguiLocator {
    constructor() {
        this.currentPosition = null;
        this.markers = this.loadMarkers();
        this.editingMarkerId = null;
        this.deletingMarkerId = null;
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
        this.renderMarkers();
        this.updateLastRecord();
        this.startTimeUpdate();
    }

    initMap() {
        this.map = L.map('map').setView([35.8617, 104.1954], 5);

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

            const allPoints = [{ lat: this.currentPosition.latitude, lng: this.currentPosition.longitude }];
            this.markers.forEach(m => {
                allPoints.push({ lat: m.latitude, lng: m.longitude });
            });

            if (allPoints.length > 1) {
                const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
                this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
            } else {
                this.map.setView([this.currentPosition.latitude, this.currentPosition.longitude], 15);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('markButton').addEventListener('click', () => this.markCurrentLocation());
        
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
                this.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                this.updateLocationDisplay();
            },
            (error) => {
                this.handleLocationError(error);
            },
            {
                enableHighAccuracy: false,
                maximumAge: 60000,
                timeout: 15000
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

        container.innerHTML = this.markers.map(marker => {
            const time = this.formatTime(new Date(marker.createdAt));
            return `
                <div class="marker-card" data-id="${marker.id}">
                    <div class="marker-header">
                        <span class="marker-name">${marker.name}</span>
                        <span class="marker-time">${time}</span>
                    </div>
                    <div class="marker-coords">
                        <span>📍 ${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}</span>
                    </div>
                    <div class="marker-actions">
                        <button class="action-btn edit-btn" data-id="${marker.id}">✏️ 重命名</button>
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
        localStorage.setItem('xiaoguiMarkers', JSON.stringify(this.markers));
    }

    loadMarkers() {
        const saved = localStorage.getItem('xiaoguiMarkers');
        return saved ? JSON.parse(saved) : [];
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
}

document.addEventListener('DOMContentLoaded', () => {
    new XiaoguiLocator();
});