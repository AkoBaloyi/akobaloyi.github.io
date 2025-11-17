// ===== Glitch Text Effect =====
const glitchText = document.querySelector('.glitch-text');

if (glitchText) {
    setInterval(() => {
        if (Math.random() > 0.95) {
            glitchText.style.textShadow = `
                ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 #00E8FF,
                ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 #C400FF
            `;
            
            setTimeout(() => {
                glitchText.style.textShadow = '0 0 20px rgba(0, 232, 255, 0.5)';
            }, 50);
        }
    }, 100);
}

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== Card Hover Effects =====
const cards = document.querySelectorAll('.pillar-card, .lab-card');

cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// ===== Console Easter Egg =====
console.log('%c🔓 AI Security Sandbox', 'color: #00E8FF; font-size: 24px; font-weight: bold;');
console.log('%cWelcome, hacker. Ready to break some AI?', 'color: #C400FF; font-size: 14px;');
console.log('%cBuilt by Ako Baloyi', 'color: #FFFFFF; font-size: 12px;');
