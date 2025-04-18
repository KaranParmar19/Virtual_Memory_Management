// Landing Page Animations and Interactions
document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const icon = themeToggle.querySelector('i');

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
        
        // Save theme preference
        const isDark = body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }

    // Navbar Animation
    const nav = document.querySelector('.main-nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > lastScroll && currentScroll > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });

    // Memory Canvas Animation
    const canvas = document.getElementById('memoryCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 3 - 1.5;
            this.speedY = Math.random() * 3 - 1.5;
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
            ctx.fillStyle = body.classList.contains('dark-mode') ? 
                'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const particleCount = Math.floor((canvas.width * canvas.height) / 10000);
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    const opacity = (100 - distance) / 100;
                    ctx.strokeStyle = body.classList.contains('dark-mode') ?
                        `rgba(96, 165, 250, ${opacity * 0.2})` :
                        `rgba(37, 99, 235, ${opacity * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        connectParticles();
        requestAnimationFrame(animate);
    }

    initParticles();
    animate();

    // GSAP Animations
    gsap.registerPlugin(ScrollTrigger);

    // Features Animation
    gsap.utils.toArray('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: "top bottom-=100",
                toggleActions: "play none none reverse"
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            delay: i * 0.2
        });
    });

    // Concepts Animation
    gsap.utils.toArray('.concept-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: item,
                start: "top center+=100",
                toggleActions: "play none none reverse"
            },
            x: i % 2 === 0 ? -100 : 100,
            opacity: 0,
            duration: 1
        });
    });

    // Simulator Preview Animation
    gsap.from('.simulator-showcase', {
        scrollTrigger: {
            trigger: '.simulator-showcase',
            start: "top center+=100",
            toggleActions: "play none none reverse"
        },
        y: 100,
        opacity: 0,
        duration: 1
    });

    // Add this function to handle the launch click
    function handleLaunchClick(e) {
        e.preventDefault();
        const pageTransition = document.querySelector('.page-transition');
        
        // Show transition
        pageTransition.style.display = 'flex';
        pageTransition.classList.add('active');
        
        // Navigate after transition completes
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }

    // Update the existing launch button event listener
    document.getElementById('launch-simulator').addEventListener('click', handleLaunchClick);

    // Page Transition
    const launchButton = document.getElementById('launch-simulator');
    const pageTransition = document.querySelector('.page-transition');
    const circuitLines = document.querySelector('.circuit-lines');

    // Create circuit lines
    function createCircuitLines() {
        const lines = 10;
        for (let i = 0; i < lines; i++) {
            const line = document.createElement('div');
            line.className = 'circuit-line';
            line.style.width = Math.random() * 100 + 50 + 'px';
            line.style.height = '2px';
            line.style.top = (i * 10) + Math.random() * 80 + '%';
            line.style.left = Math.random() * 100 + '%';
            line.style.animationDelay = Math.random() * 2 + 's';
            circuitLines.appendChild(line);
        }
    }

    createCircuitLines();

    // Handle simulator launch
    launchButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Start transition
        pageTransition.classList.add('active');
        
        // Add some dynamic circuit lines during transition
        setInterval(() => {
            const line = document.createElement('div');
            line.className = 'circuit-line';
            line.style.width = Math.random() * 100 + 50 + 'px';
            line.style.height = '2px';
            line.style.top = Math.random() * 100 + '%';
            line.style.left = Math.random() * 100 + '%';
            circuitLines.appendChild(line);
            
            // Remove the line after animation
            setTimeout(() => line.remove(), 2000);
        }, 200);

        // Animate transition content
        gsap.to('.transition-content', {
            scale: 1.1,
            duration: 0.5,
            ease: 'power2.inOut',
            yoyo: true,
            repeat: 1
        });

        // Navigate to simulator after transition
        setTimeout(() => {
            pageTransition.classList.add('exit');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 500);
        }, 1500);
    });
});
// Updated page transition in landing.js and main.js
function handlePageTransition(targetUrl) {
    const pageTransition = document.querySelector('.page-transition');
    
    // Show transition
    pageTransition.style.display = 'flex';
    pageTransition.classList.add('active');
    
    // Create dynamic circuit lines during transition
    const circuitInterval = setInterval(() => {
        const line = document.createElement('div');
        line.className = 'circuit-line';
        line.style.width = `${Math.random() * 100 + 50}px`;
        line.style.top = `${Math.random() * 100}%`;
        line.style.left = `${Math.random() * 100}%`;
        line.style.animationDelay = `${Math.random() * 2}s`;
        pageTransition.querySelector('.circuit-lines').appendChild(line);
        
        // Remove after animation
        setTimeout(() => line.remove(), 2000);
    }, 200);

    // Animate transition content
    gsap.to('.transition-content', {
        scale: 1.1,
        duration: 0.5,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
    });

    // Navigate after transition
    setTimeout(() => {
        clearInterval(circuitInterval);
        window.location.href = targetUrl;
    }, 1500);
}