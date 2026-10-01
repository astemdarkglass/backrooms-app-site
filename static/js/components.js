document.addEventListener('click', (e) => {
    // --- Табы ---
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn) {
        const container = tabBtn.closest('.tabs-container');
        const index = [...container.querySelectorAll('.tab-btn')].indexOf(tabBtn);
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tabBtn.classList.add('active');
        container.querySelectorAll('.tab-pane')[index].classList.add('active');
    }

    // --- Коллапс ---
    const collapseHeader = e.target.closest('.collapse-header');
    if (collapseHeader) {
        collapseHeader.parentElement.classList.toggle('open');
    }

    // --- Карусель ---
    const carouselBtn = e.target.closest('.carousel-btn');
    if (carouselBtn) {
        const carousel = carouselBtn.closest('.carousel');
        const track = carousel.querySelector('.carousel-track');
        const slides = track.children.length;
        let index = parseInt(carousel.dataset.index || '0');
        index = carouselBtn.classList.contains('next')
            ? (index + 1) % slides
            : (index - 1 + slides) % slides;
        carousel.dataset.index = index;
        track.style.transform = `translateX(-${index * 100}%)`;
    }
});

// Автопрокрутка каруселей
function initCarousels() {
    document.querySelectorAll('.carousel[data-autoplay="true"]').forEach(carousel => {
        if (carousel.dataset.initialized) return;
        carousel.dataset.initialized = '1';
        carousel.dataset.index = '0';
        const interval = parseInt(carousel.dataset.interval || '4000');
        setInterval(() => {
            const next = carousel.querySelector('.carousel-btn.next');
            if (next) next.click();
        }, interval);
    });
}