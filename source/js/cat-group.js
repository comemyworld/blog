/**
 * 「分类页」按子分类分组卡片 + 展开/收起（通用脚本，支持多个父分类）
 *
 * 支持的分类页 & 子分类识别规则，在下方 CONFIG 里配置：
 *   - 每个分类页（技术文档 / 相册 / 旅行 ...）各自一个条目
 *   - 脚本会在每张 .home-card 上找 .home-card-cats > span.home-card-cat，
 *     取其中"不是当前父分类名"的那一项作为"子分类名"（Linux / 生活 / 记录 / SpringBoot ...）
 *   - 按子分类 groupBy → 每组渲染 <h2>标题 + 前 2 张默认显示 + 剩余折叠 + 展开/收起按钮
 *
 * 启用条件：_config.butterfly.yml 中 category_ui: index（分类页渲染为首页同款卡片网格）
 */
(function () {
  'use strict';

  /* ============================================================
   * CONFIG：在这里加/改父分类页条目，想再做"旅行"等效果复制下面一项即可
   * ============================================================ */
  const CONFIG = [
    {
      parentName: '技术文档',                              // 卡片分类上写的「父分类名」
      matchPaths: [
        '/categories/%E6%8A%80%E6%9C%AF%E6%96%87%E6%A1%A3/',   // URL encode 后的"技术文档"
        '/categories/技术文档/',                                   // 部分浏览器直接显示中文
      ],
      showByDefault: 2,    // 每组默认显示前 2 张
    },
    {
      parentName: '相册',
      matchPaths: [
        '/categories/%E7%9B%B8%E5%86%8C/',      // URL encode「相册」
        '/categories/相册/',
      ],
      showByDefault: 2,
    },
    // 以后想做「旅行手记」就加这一项：
    // {
    //   parentName: '旅行手记',
    //   matchPaths: [
    //     '/categories/%E6%97%85%E8%A1%8C%E6%89%8B%E8%AE%B0/',
    //     '/categories/旅行手记/',
    //   ],
    //   showByDefault: 2,
    // },
  ];

  /* ============================================================
   * 工具：判断当前路径是否命中某个配置
   * ============================================================ */
  const normalize = (s) => s.replace(/\/+$/, '') + '/';
  const hit = () => {
    const cur = normalize(window.location.pathname);
    for (const c of CONFIG) {
      for (const p of c.matchPaths) {
        if (normalize(p) === cur) return c;
      }
    }
    return null;
  };

  const cfg = hit();
  if (!cfg) return;

  const PARENT = cfg.parentName;
  const SHOW_BY_DEFAULT = cfg.showByDefault | 0 || 2;

  /* ============================================================
   * 找到卡片容器
   * ============================================================ */
  const root = document.getElementById('home-portfolio');
  if (!root) return;
  const items = root.querySelector('.home-portfolio-items');
  if (!items) return;

  const allCards = Array.from(items.querySelectorAll(':scope > a.home-card'));
  if (allCards.length === 0) return;

  /* ============================================================
   * 从卡片 DOM 上读取"子分类名"（.home-card-cats 中除 PARENT 之外的第一项）
   * ============================================================ */
  const getSubCategory = (cardEl) => {
    const catSpans = cardEl.querySelectorAll('.home-card-cats .home-card-cat');
    if (!catSpans || catSpans.length === 0) return '其它';
    for (const s of catSpans) {
      const n = (s.textContent || '').trim();
      if (n && n !== PARENT) return n;
    }
    return '其它';
  };

  /* ============================================================
   * groupBy
   * ============================================================ */
  const groups = new Map();
  for (const card of allCards) {
    const key = getSubCategory(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  if (groups.size === 0) return;

  /* ============================================================
   * 构建分组后的 DOM
   * ============================================================ */
  const frag = document.createDocumentFragment();

  groups.forEach((cards, subName) => {
    const section = document.createElement('section');
    section.className = 'cat-group';

    // 标题：左侧蓝条 + h2 + 篇数胶囊
    const total = cards.length;
    const title = document.createElement('div');
    title.className = 'cat-group-title';
    title.innerHTML = `
      <span class="cat-group-bar"></span>
      <h2>${escapeHtml(subName)}<small class="cat-group-count">共 ${total} 篇</small></h2>
    `;
    section.appendChild(title);

    // 卡片网格
    const gridTop = document.createElement('div');
    gridTop.className = 'home-portfolio-items cat-group-grid';

    cards.forEach((c, idx) => {
      if (idx < SHOW_BY_DEFAULT) gridTop.appendChild(c);
    });

    // 剩余卡片 -> 折叠容器
    const rest = cards.slice(SHOW_BY_DEFAULT);
    let moreBox = null;
    let btn = null;
    if (rest.length > 0) {
      moreBox = document.createElement('div');
      moreBox.className = 'cat-more cat-collapsed';
      const inner = document.createElement('div');
      inner.className = 'home-portfolio-items cat-group-grid';
      rest.forEach((c) => inner.appendChild(c));
      moreBox.appendChild(inner);

      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-expand-btn';
      btn.dataset.state = 'collapsed';
      btn.innerHTML = `
        <span class="cat-expand-label">展开更多 <b class="cat-expand-num">${rest.length}</b> 篇</span>
        <i class="fas fa-chevron-down"></i>
      `;
      btn.addEventListener('click', () => {
        const st = btn.dataset.state;
        if (st === 'collapsed') {
          moreBox.classList.remove('cat-collapsed');
          btn.dataset.state = 'expanded';
          btn.querySelector('.cat-expand-label').textContent = '收起';
          btn.querySelector('i').className = 'fas fa-chevron-up';
        } else {
          moreBox.classList.add('cat-collapsed');
          btn.dataset.state = 'collapsed';
          btn.querySelector('.cat-expand-label').innerHTML =
            `展开更多 <b class="cat-expand-num">${rest.length}</b> 篇`;
          btn.querySelector('i').className = 'fas fa-chevron-down';
        }
      });
    }

    section.appendChild(gridTop);
    if (moreBox) section.appendChild(moreBox);
    if (btn) section.appendChild(btn);

    frag.appendChild(section);
  });

  /* ============================================================
   * 替换：保留分页节点
   * ============================================================ */
  items.remove();
  const pagination = root.querySelector('nav.pagination');
  root.innerHTML = '';
  root.appendChild(frag);
  if (pagination) root.appendChild(pagination);

  /* ============================================================
   * PJAX 切页复用
   * ============================================================ */
  if (window.pjax) {
    document.addEventListener('pjax:complete', () => {
      if (hit()) requestAnimationFrame(init);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function init() {
    if (document.body.dataset.catGroupInited === '1') return;
    document.body.dataset.catGroupInited = '1';
  }
  init();
})();
