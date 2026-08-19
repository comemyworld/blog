/* =========================================================
 * 视频背景：自动在 #web_bg 后面插入 <video> 作为动态背景
 * - 加载失败/移动端自动回退到原图片背景
 * - 视频静音自动播放循环（浏览器 autoplay 必须 muted）
 * ========================================================= */
(function () {
  'use strict';

  // ======== 在这里配置你的视频路径 ========
  // 支持：本地文件（推荐放 source/videos/ 目录下）或外链 mp4/webm
  // 同时也可以配置 webm 格式（体积更小，浏览器优先播 webm）
  var CONFIG = {
    // 主视频（mp4 兼容性最好，必填）
    mp4: '/videos/bg.mp4',
    // 可选：webm 格式（体积更小，优先播放，不支持可留空字符串 ''）
    webm: '',
    // 可选：视频首帧封面图（视频加载前显示，防止黑屏，不填留 ''）
    poster: '/images/maozedong.jpg',
    // 播放速度（1 = 原速，0.6 = 慢放，1.2 = 快放）
    playbackRate: 1,
    // 视频加载超时多少毫秒后放弃，回退到图片背景
    timeout: 8000,
  };
  // =======================================

  if (!CONFIG.mp4 && !CONFIG.webm) return;

  function insertVideo() {
    // 只在 body 存在时执行
    if (!document.body) return;

    // 避免重复插入
    if (document.getElementById('video_bg')) return;

    var video = document.createElement('video');
    video.id = 'video_bg';
    video.className = 'video-loading'; // 初始隐藏，等能播放时淡入
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', ''); // iOS Safari 必须
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('preload', 'auto');
    if (CONFIG.poster) video.setAttribute('poster', CONFIG.poster);

    // 按优先级添加源：webm > mp4
    var hasSource = false;
    if (CONFIG.webm) {
      var src1 = document.createElement('source');
      src1.src = CONFIG.webm;
      src1.type = 'video/webm';
      video.appendChild(src1);
      hasSource = true;
    }
    if (CONFIG.mp4) {
      var src2 = document.createElement('source');
      src2.src = CONFIG.mp4;
      src2.type = 'video/mp4';
      video.appendChild(src2);
      hasSource = true;
    }
    if (!hasSource) return;

    // 插入到 body 开头（作为第一子节点，层级在 #web_bg 之上）
    document.body.insertBefore(video, document.body.firstChild);

    // 错误兜底：任何情况加载失败，直接移除 video，退回到图片背景
    function fallback() {
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    }

    video.addEventListener('error', fallback, { once: true });
    // 所有 <source> 都加载失败时触发
    video.addEventListener(
      'loadstart',
      function () {
        var timer = setTimeout(function () {
          // 超时还没 loadeddata，可能网络差或文件不存在
          if (video.readyState < 1) fallback();
        }, CONFIG.timeout);
        video.addEventListener(
          'loadeddata',
          function () {
            clearTimeout(timer);
            // 能播放了 → 淡入
            requestAnimationFrame(function () {
              video.classList.remove('video-loading');
            });
            if (CONFIG.playbackRate !== 1) {
              try {
                video.playbackRate = CONFIG.playbackRate;
              } catch (e) {
                /* ignore */
              }
            }
            // 兜底：有些浏览器自动播放会被拦截，手动 play 一下
            var p = video.play();
            if (p && typeof p.catch === 'function') {
              p.catch(function () {
                fallback();
              });
            }
          },
          { once: true }
        );
      },
      { once: true }
    );
  }

  // DOM ready 就注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertVideo, { once: true });
  } else {
    insertVideo();
  }
})();
