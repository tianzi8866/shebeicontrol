/**
 * 化工装置智能控制器 — 网站交互脚本
 * 处理移动端导航菜单、页面动画等
 */

document.addEventListener('DOMContentLoaded', function () {

    // ── 移动端汉堡菜单 ──
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            navLinks.classList.toggle('open');
            // 切换图标
            navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
        });

        // 点击导航链接后自动关闭菜单
        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('open');
                navToggle.textContent = '☰';
            });
        });

        // 点击菜单外部区域关闭
        document.addEventListener('click', function (e) {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
                navToggle.textContent = '☰';
            }
        });
    }

    // ── 当前页面高亮 ──
    // （已在 HTML 中通过 .active 类静态设置，此处为备用）

    // ── 平滑滚动（锚点链接） ──
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ── 页面滚动时导航栏阴影加深 ──
    var navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 10) {
                navbar.style.boxShadow = '0 2px 16px rgba(0,0,0,0.25)';
            } else {
                navbar.style.boxShadow = '0 1px 8px rgba(0,0,0,0.15)';
            }
        });
    }
});
