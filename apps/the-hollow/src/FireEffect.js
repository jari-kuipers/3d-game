export class FireEffect {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.width = canvas.width;
        this.height = canvas.height;
        this.maxParticles = 100;

        // Resize handler
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    start() {
        this.animate();
    }

    createParticle() {
        return {
            x: Math.random() * this.width,
            y: this.height + Math.random() * 50, // Start below screen
            size: Math.random() * 3 + 1,
            speedY: Math.random() * 1 + 0.5,
            speedX: (Math.random() - 0.5) * 0.5,
            color: `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${Math.random() * 0.5 + 0.2})`,
            life: Math.random() * 0.5 + 0.5
        };
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Add particles
        if (this.particles.length < this.maxParticles) {
            this.particles.push(this.createParticle());
        }

        // Update and draw
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.y -= p.speedY;
            p.x += p.speedX + Math.sin(p.y * 0.05) * 0.2; // Wobbly movement
            p.life -= 0.005;

            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Reset dead particles
            if (p.life <= 0 || p.y < -10) {
                this.particles[i] = this.createParticle();
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}
