/* static/js/random-ad.js */
(function() {
    'use strict';

    var AD_CONFIG = {
        imagePath: '/static/assets/images/ads/',
        images: ['ad1.jpg', 'ad2.jpg', 'ad3.jpg', 'ad4.jpg', 'ad5.jpg'],
        captions: [
            '🔥 Скидка 50% на Миндальную воду! Только сегодня!',
            '📚 Новое руководство по выживанию в Закулисье — уже в продаже!',
            '🔦 Фонари повышенной яркости — не останься в темноте!',
            '🧭 Навигатор по уровням — никогда не забудься!',
            '💊 Аптечка странника — всё необходимое в одном месте!'
        ],
        links: ['#', '#', '#', '#', '#']
    };

    function renderAd() {
        var adContainer = document.getElementById('adContainer');
        if (!adContainer) return;

        var i = Math.floor(Math.random() * AD_CONFIG.images.length);
        var imageFile = AD_CONFIG.images[i];
        var caption = AD_CONFIG.captions[i] || 'Реклама';
        var link = AD_CONFIG.links[i] || '#';

        adContainer.innerHTML = `
            <div class="ad-block">
                <a href="${link}" target="_blank" class="ad-link">
                    <img src="${AD_CONFIG.imagePath}${imageFile}" alt="Реклама" class="ad-image"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22%3E%3Crect fill=%22%23e0d8d0%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%2240%22 y=%2275%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23666%22%3E%D0%A0%D0%B5%D0%BA%D0%BB%D0%B0%D0%BC%D0%B0%3C/text%3E%3C/svg%3E'">
                    <div class="ad-caption">${caption}</div>
                </a>
            </div>
        `;
    }

    // Делаем функцию глобальной, чтобы app.js мог её вызывать
    window.renderAd = renderAd;

    // Первый вызов после загрузки DOM
    document.addEventListener('DOMContentLoaded', renderAd);
})();