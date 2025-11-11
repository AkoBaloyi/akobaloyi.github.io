// ===== Loading Screen =====
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 1500);
});

// ===== Particle Canvas Animation =====
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];
const particleCount = 80;

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        ctx.fillStyle = `rgba(108, 99, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    // Draw connections
    particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
                ctx.strokeStyle = `rgba(108, 99, 255, ${0.2 * (1 - distance / 100)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        });
    });

    requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ===== Navigation =====
const navbar = document.getElementById('navbar');
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-menu a');

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    
    // Animate hamburger
    const spans = navToggle.querySelectorAll('span');
    if (navMenu.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translateY(8px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translateY(-8px)';
    } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    }
});

// Close mobile menu on link click
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    });
});

// ===== Scroll Reveal Animation =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => {
    observer.observe(el);
});

// ===== Rotating Quotes =====
const quotes = [
    "Success isn't luxury — it's peace.",
    "Understanding is more powerful than speed.",
    "Discipline builds freedom."
];

let currentQuoteIndex = 0;
const quoteElement = document.querySelector('.rotating-quote');

function rotateQuote() {
    quoteElement.style.opacity = '0';
    
    setTimeout(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
        quoteElement.textContent = quotes[currentQuoteIndex];
        quoteElement.style.opacity = '1';
    }, 500);
}

// Initialize first quote
quoteElement.textContent = quotes[0];

// Rotate quotes every 4 seconds
setInterval(rotateQuote, 4000);

// ===== Contact Form =====
const contactForm = document.querySelector('.contact-form');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const message = formData.get('message');
    
    // Here you would typically send the data to a server
    // For now, we'll just show a success message
    alert(`Thank you, ${name}! Your message has been received. I'll get back to you at ${email} soon.`);
    
    contactForm.reset();
});

// ===== Easter Egg =====
const easterEgg = document.querySelector('.easter-egg');
let clickCount = 0;

easterEgg.addEventListener('click', () => {
    clickCount++;
    
    if (clickCount === 1) {
        easterEgg.textContent = '🔓';
        easterEgg.style.color = 'var(--accent-violet)';
    }
    
    if (clickCount === 3) {
        easterEgg.textContent = '✨';
        document.body.style.animation = 'colorShift 3s ease-in-out';
        
        setTimeout(() => {
            easterEgg.textContent = '🔒';
            easterEgg.style.color = '';
            clickCount = 0;
        }, 3000);
    }
});

// ===== Smooth Scroll Enhancement =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 70;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Cursor Glow Effect (Desktop Only) =====
if (window.innerWidth > 768) {
    const cursorGlow = document.createElement('div');
    cursorGlow.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(108, 99, 255, 0.3), transparent);
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: width 0.2s, height 0.2s;
    `;
    document.body.appendChild(cursorGlow);

    document.addEventListener('mousemove', (e) => {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });

    // Expand glow on interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .project-card, .personal-card');
    
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorGlow.style.width = '40px';
            cursorGlow.style.height = '40px';
        });
        
        el.addEventListener('mouseleave', () => {
            cursorGlow.style.width = '20px';
            cursorGlow.style.height = '20px';
        });
    });
}

// ===== Performance Optimization =====
// Debounce scroll events
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
    }
    
    scrollTimeout = window.requestAnimationFrame(() => {
        // Scroll-based animations can be added here
    });
});

// ===== Console Easter Egg =====
console.log('%c👋 Hello, curious developer!', 'color: #6C63FF; font-size: 20px; font-weight: bold;');
console.log('%cI see you\'re checking under the hood. I like that.', 'color: #70E0FF; font-size: 14px;');
console.log('%cFeel free to reach out if you want to build something together.', 'color: #E0E0E0; font-size: 12px;');
