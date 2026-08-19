/**
 * 1. 首页无限滚动（仅 body.home 生效）
 */
(function initInfiniteScroll() {
  if (!document.body || !document.body.classList.contains('home')) return;

  const container = document.querySelector('.home-portfolio-items');
  const pagination = document.querySelector(
    '.home-portfolio .pagination, .pagination',
  );
  if (!container) return;

  let page = 2;
  let loading = false;
  let hasMore = true;
  let sentinel = null;
  const TRIGGER_DISTANCE = 400; // 距底 400px 开始加载

  // 隐藏底部分页按钮（改成自动加载），但保留 DOM 以便降级
  if (pagination) {
    pagination.style.setProperty('display', 'none', 'important');
  }

  // 加载提示：最后追加一个"正在加载 / 已经到底了"提示卡
  const hint = document.createElement('div');
  hint.className = 'home-scroll-hint';
  hint.style.cssText = [
    'grid-column: 1 / -1',
    'text-align: center',
    'padding: 16px 0 24px',
    'color: rgba(255,255,255,0.75)',
    'font-size: 13px',
    'letter-spacing: 1px',
    'text-shadow: 0 2px 8px rgba(0,0,0,0.25)',
  ].join(';');
  container.parentNode.appendChild(hint);
  hint.textContent = '向下滑动，加载更多作品 ↓';

  const setHint = (text) => {
    hint.textContent = text;
  };

  async function loadNextPage() {
    if (loading || !hasMore) return;
    loading = true;
    setHint('加载中...');

    try {
      const url = `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/page/${page}/`;
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        hasMore = false;
        setHint('— 已经到底啦 —');
        return;
      }
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextCards = doc.querySelectorAll('.home-card');
      if (!nextCards.length) {
        hasMore = false;
        setHint('— 已经到底啦 —');
        return;
      }

      // 把新卡片追加进容器
      const frag = document.createDocumentFragment();
      nextCards.forEach((c, i) => {
        // 重置入场动画延迟（基于已有卡片数量）
        const existCount = container.querySelectorAll('.home-card').length;
        const order = (existCount + i) % 3;
        const delays = ['0.02s', '0.10s', '0.18s'];
        c.style.animation = 'none';
        frag.appendChild(c);
        requestAnimationFrame(() => {
          c.style.animation = '';
          c.style.animationDelay = delays[order];
        });
      });
      container.appendChild(frag);

      page++;
      setHint('向下滑动，加载更多作品 ↓');
    } catch (e) {
      // 出错了不中断，等下一次用户再滚动时重试
      setHint('加载失败，稍后再试');
    } finally {
      loading = false;
    }
  }

  // 滚动触发
  function onScroll() {
    if (loading || !hasMore) return;
    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollBottom >= docHeight - TRIGGER_DISTANCE) {
      loadNextPage();
    }
  }

  // PJAX 兼容：切页后重新绑定无限滚动
  if (window.pjax) {
    document.addEventListener('pjax:complete', () => {
      if (document.body.classList.contains('home')) {
        page = 2;
        hasMore = true;
        onScroll();
      }
    });
  }
})();

/**
 * 2. 浮动胶囊导航：
 *    任意页面只要 <nav id=nav> 上带了 .nav-home-float class
 *    （由 nav.pug 控制：首页 / 技术文档分类 / 相册分类 …）
 *    就启动：
 *      - 对抗主题 scroll 脚本写入的内联 style
 *      - Headroom：下滑隐藏（marginTop:-140）、上滑显示
 */
(function initAutoHideNav() {
  const nav = document.getElementById('nav');
  if (!nav || !nav.classList.contains('nav-home-float')) return;

  const resetStyle = () => {
    if (nav.hasAttribute('style')) nav.removeAttribute('style');
  };
  resetStyle();
  const mo = new MutationObserver(() => resetStyle());
  mo.observe(nav, { attributes: true, attributeFilter: ['style'] });

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    if (currentY < 40) {
      nav.classList.remove('nav-auto-hide');
    } else if (Math.abs(delta) > 6) {
      if (delta > 0) nav.classList.add('nav-auto-hide');
      else nav.classList.remove('nav-auto-hide');
    }
    lastY = currentY > 0 ? currentY : 0;
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true },
  );

  if (window.pjax) {
    document.addEventListener('pjax:complete', () => {
      if (
        document.getElementById('nav') &&
        document.getElementById('nav').classList.contains('nav-home-float')
      ) {
        initAutoHideNav();
      }
    });
  }
})();
