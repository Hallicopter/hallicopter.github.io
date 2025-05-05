var canvas;
var body = document.body,
    html = document.documentElement;

let height;
let width = Math.max(body.scrollWidth, body.offsetWidth,
    html.clientWidth, html.scrollWidth, html.offsetWidth);

// Get the true document height
function getDocHeight() {
    return Math.max(
        document.body.scrollHeight, 
        document.body.offsetHeight,
        document.documentElement.clientHeight, 
        document.documentElement.scrollHeight, 
        document.documentElement.offsetHeight
    );
}

// Set a reasonable max height for performance
const MAX_CANVAS_HEIGHT = 2500;

// Elegant color palette to match the site design
const COLORS = {
    background: '#FAFAFA',  // Very light gray background
    accent: '#B22222',      // Elegant red accent
    subtle: '#F8F8F8'       // Subtle gray for patterns
};

let stars = [];
let comets = [];
let patterns = [];
let tick = 0;

document.addEventListener('DOMContentLoaded', function() {
    new p5(function(p) {
        let canvas;

        p.setup = function() {
            // Limit the canvas height
            height = Math.min(
                Math.max(window.innerHeight, 800),
                MAX_CANVAS_HEIGHT
            );
            width = window.innerWidth;
            
            canvas = p.createCanvas(width, height);
            p.colorMode(p.HSB, 360, 100, 100, 1);
            p.background(COLORS.background);

            // Create subtle pattern elements instead of stars
            for (let i = 0; i < 80; i++) {
                let x = p.random(width);
                let y = p.random(height);
                
                stars.push({
                    x: x,
                    y: y,
                    size: p.random(1, 3),
                    brightness: p.random(20, 40),
                    twinkleSpeed: p.random(0.005, 0.01),
                    twinklePhase: p.random(p.TWO_PI),
                    isBright: p.random() < 0.1 // 10% chance for brighter elements
                });
            }
            
            // Create subtle background patterns
            for (let i = 0; i < 15; i++) {
                patterns.push({
                    x: p.random(width),
                    y: p.random(height),
                    size: p.random(80, 200),
                    opacity: p.random(0.01, 0.03),
                    speed: p.random(0.0005, 0.001),
                    phase: p.random(p.TWO_PI)
                });
            }

            canvas.style('z-index', '-1');
            canvas.style('position', 'fixed'); 
            canvas.style('top', '0');
            canvas.style('left', '0');
            p.blendMode(p.MULTIPLY); // Subtle multiply blend for elegant effect
        }

        p.windowResized = function() {
            height = Math.min(
                Math.max(window.innerHeight, 800),
                MAX_CANVAS_HEIGHT
            );
            p.resizeCanvas(window.innerWidth, height);
            p.background('#0E192B');
        }

        p.draw = function() {
            p.clear();
            p.background(COLORS.background);
            
            // Draw and update subtle background patterns
            patterns.forEach(pattern => {
                let movement = p.sin(p.frameCount * pattern.speed + pattern.phase);
                let x = pattern.x + movement * 20;
                let y = pattern.y + p.cos(p.frameCount * pattern.speed) * 10;
                
                p.noStroke();
                // Use the accent color with very low opacity
                let h = 0; // Red hue in HSB
                let s = 80; // Saturation for the elegant red
                p.fill(h, s, 80, pattern.opacity);
                p.ellipse(x, y, pattern.size, pattern.size * 0.6);
            });

            // Draw and update subtle dots
            stars.forEach(star => {
                let primaryTwinkle = p.map(p.sin(p.frameCount * star.twinkleSpeed + star.twinklePhase), -1, 1, 0.8, 1);
                let secondaryTwinkle = p.map(p.sin(p.frameCount * star.twinkleSpeed * 1.5), -1, 1, 0.9, 1);
                let finalTwinkle = primaryTwinkle * secondaryTwinkle;

                // Subtle variation for visual interest
                if (star.isBright) {
                    finalTwinkle = p.map(finalTwinkle, 0.8, 1, 0.9, 1.2);
                }
                
                p.noStroke();
                // Use elegant red from our color palette with very low opacity
                let h = 0; // Red hue in HSB
                let s = 80; // Saturation for the elegant red
                let mainOpacity = star.isBright ? 0.04 : 0.02;
                p.fill(h, s, 80, mainOpacity);
                p.circle(star.x, star.y, star.size * finalTwinkle);
                
                // Very subtle glow
                let glowOpacity = star.isBright ? 0.02 : 0.01;
                p.fill(h, s, 80, glowOpacity);
                p.circle(star.x, star.y, star.size * finalTwinkle * 2);
            });

            // Very occasional elegant line effect (much less frequent)
            if (comets.length < 1 && p.random(1) < 0.01) {
                let startX = p.random(p.width);
                let startY = -20;
                let angle = p.PI/2 + p.random(-0.1, 0.1); // Mostly vertical with slight variation
                
                comets.push(new Comet(p, startX, startY, angle));
            }

            // Update and draw comets
            for (let i = comets.length - 1; i >= 0; i--) {
                comets[i].update();
                comets[i].display();
                if (comets[i].isDead()) {
                    comets.splice(i, 1);
                }
            }

            tick++;
        }
    });
});

class Comet {
    constructor(p, x, y, angle, speed = p.random(0.5, 1)) {
        this.p = p;
        this.pos = p.createVector(x, y);
        this.vel = p5.Vector.fromAngle(angle);
        this.vel.mult(speed);
        this.history = [];
        this.lifetime = 800;
        this.size = p.random(0.8, 1.2);
        this.alpha = 1;
    }

    update() {
        this.pos.add(this.vel);
        this.history.push(this.p.createVector(this.pos.x, this.pos.y));
        
        if (this.history.length > 100) {
            this.history.splice(0, 1);
        }
        
        this.lifetime--;
        this.alpha = this.p.map(this.lifetime, 800, 0, 1, 0, true);
    }

    display() {
        // Draw elegant line with the accent color
        this.p.noFill();
        this.p.beginShape();
        for (let i = 0; i < this.history.length; i++) {
            let pos = this.history[i];
            let alpha = this.p.map(i, 0, this.history.length, 0, 1);
            // Use our elegant red color with very low opacity
            this.p.stroke(0, 80, 80, 0.03 * alpha * this.alpha);
            this.p.vertex(pos.x, pos.y);
        }
        this.p.endShape();
        
        // Very subtle dot at the end
        this.p.noStroke();
        this.p.fill(0, 80, 80, 0.05 * this.alpha);
        this.p.circle(this.pos.x, this.pos.y, this.size);
    }

    isDead() {
        return this.lifetime < 0 || 
               this.pos.x < -100 || 
               this.pos.x > this.p.width + 100 || 
               this.pos.y < -100 || 
               this.pos.y > this.p.height + 100;
    }
}
