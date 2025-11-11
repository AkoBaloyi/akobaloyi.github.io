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
    "Success isn't luxury, it's peace",
    "Understanding is more powerful than speed",
    "Discipline builds freedom",
    "Curiosity before certainty",
    "Build systems that outlast you"
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
const formStatus = document.querySelector('.form-status');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // Create mailto link with form data
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
    const body = encodeURIComponent(
        `Name: ${name}\n` +
        `Email: ${email}\n\n` +
        `Message:\n${message}\n\n` +
        `---\n` +
        `Sent from akobaloyi.github.io`
    );
    
    const mailtoLink = `mailto:Akobaloyi01@gmail.com?subject=${subject}&body=${body}`;
    
    // Open email client
    window.location.href = mailtoLink;
    
    // Show success message
    formStatus.textContent = 'Opening your email client... If it doesn\'t open, please email me directly.';
    formStatus.style.display = 'block';
    formStatus.style.color = '#4ade80';
    
    // Reset form after a delay
    setTimeout(() => {
        contactForm.reset();
        formStatus.style.display = 'none';
    }, 3000);
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

// ===== Hero Typing Animation =====
const heroTitle = document.querySelector('.hero h1');
const originalText = heroTitle.textContent;
let typingComplete = false;

function typeWriter(element, text, speed = 100) {
    element.textContent = '';
    element.style.opacity = '1';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            typingComplete = true;
        }
    }
    
    type();
}

// Start typing after loading screen
setTimeout(() => {
    typeWriter(heroTitle, originalText, 80);
}, 1800);

// ===== Konami Code Easter Egg =====
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        
        if (konamiIndex === konamiCode.length) {
            activateKonamiEasterEgg();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function activateKonamiEasterEgg() {
    // Create special effect
    document.body.style.animation = 'rainbow 2s ease-in-out';
    
    // Show special message
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(108, 99, 255, 0.95);
        color: white;
        padding: 3rem;
        border-radius: 20px;
        font-size: 1.5rem;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 0 50px rgba(108, 99, 255, 0.8);
        animation: fadeInUp 0.5s ease-out;
    `;
    message.innerHTML = `
        <h2 style="margin-bottom: 1rem;">🎮 Code Unlocked!</h2>
        <p>"The best systems are built by those who explore them."</p>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translate(-50%, -50%) scale(0.8)';
        message.style.transition = 'all 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 3000);
}

// ===== Console Easter Egg =====
console.log('%c👋 Hello, curious developer!', 'color: #6C63FF; font-size: 20px; font-weight: bold;');
console.log('%cI see you\'re checking under the hood. I like that.', 'color: #70E0FF; font-size: 14px;');
console.log('%cFeel free to reach out if you want to build something together.', 'color: #E0E0E0; font-size: 12px;');
console.log('%c💡 Tip: Try the Konami Code (↑↑↓↓←→←→BA)', 'color: #6C63FF; font-size: 12px; font-style: italic;');
