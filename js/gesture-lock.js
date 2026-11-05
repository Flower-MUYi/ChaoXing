/**
 * Chaoxing Web Sign - 手势签到 9 宫格 Canvas 组件
 * 完美支持移动端触摸与桌面端鼠标连线交互
 */

class GestureLock {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = Object.assign({
      gridSize: 3,
      nodeRadius: 18,
      selectedNodeRadius: 22,
      normalColor: '#cbd5e1',
      activeColor: '#3b82f6',
      lineColor: '#60a5fa',
      lineWidth: 4,
      onComplete: (pattern) => console.log('Gesture pattern:', pattern)
    }, options);

    this.points = [];
    this.selectedPoints = [];
    this.currentPos = null;
    this.isDragging = false;

    this.initCanvasSize();
    this.initPoints();
    this.bindEvents();
    this.render();
  }

  initCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 280;
    this.height = rect.height || 280;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  initPoints() {
    this.points = [];
    const size = this.options.gridSize;
    const padding = 35;
    const stepX = (this.width - padding * 2) / (size - 1);
    const stepY = (this.height - padding * 2) / (size - 1);

    let id = 1;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        this.points.push({
          id: id++,
          x: padding + col * stepX,
          y: padding + row * stepY,
          row,
          col
        });
      }
    }
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handleStart = (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.selectedPoints = [];
      const pos = getPos(e);
      this.checkHit(pos);
      this.currentPos = pos;
      this.render();
    };

    const handleMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const pos = getPos(e);
      this.checkHit(pos);
      this.currentPos = pos;
      this.render();
    };

    const handleEnd = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this.isDragging = false;
      this.currentPos = null;
      this.render();

      const result = this.selectedPoints.map(p => p.id).join('');
      if (result && typeof this.options.onComplete === 'function') {
        this.options.onComplete(result);
      }
    };

    this.canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    this.canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd, { passive: false });
  }

  checkHit(pos) {
    const hitRadius = this.options.nodeRadius * 1.8;
    for (const point of this.points) {
      const dist = Math.hypot(point.x - pos.x, point.y - pos.y);
      if (dist <= hitRadius && !this.selectedPoints.includes(point)) {
        this.selectedPoints.push(point);
        break;
      }
    }
  }

  reset() {
    this.selectedPoints = [];
    this.currentPos = null;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 绘制连线
    if (this.selectedPoints.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = this.options.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(this.selectedPoints[0].x, this.selectedPoints[0].y);
      for (let i = 1; i < this.selectedPoints.length; i++) {
        ctx.lineTo(this.selectedPoints[i].x, this.selectedPoints[i].y);
      }

      if (this.currentPos) {
        ctx.lineTo(this.currentPos.x, this.currentPos.y);
      }
      ctx.stroke();
    }

    // 绘制 9 个点
    for (const point of this.points) {
      const isSelected = this.selectedPoints.includes(point);
      
      // 外圈光晕
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.options.selectedNodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
      }

      // 点圆
      ctx.beginPath();
      ctx.arc(point.x, point.y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? this.options.activeColor : this.options.normalColor;
      ctx.fill();
    }
  }
}

window.GestureLock = GestureLock;
