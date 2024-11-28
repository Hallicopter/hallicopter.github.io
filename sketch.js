var canvas;
var mic;
var body = document.body,
    html = document.documentElement;

let height;
let width = Math.max( body.scrollWidth, body.offsetWidth,
    html.clientWidth, html.scrollWidth, html.offsetWidth );

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
const MAX_CANVAS_HEIGHT = 2100;

let stars = [];
let comets = [];
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
            p.background('#0E192B');

            // Create stars with higher density on sides, but fewer overall
            for (let i = 0; i < 250; i++) {
                let x, y;
                
                if (p.random() < 0.8) {
                    x = p.random() < 0.5 ? 
                        p.random(0, width * 0.25) : 
                        p.random(width * 0.75, width);
                } else {
                    x = p.random(width * 0.25, width * 0.75);
                }
                
                let normalizedY = p.random();
                y = height * normalizedY;
                
                stars.push({
                    x: x,
                    y: y,
                    size: p.random(0.8, 2.5),
                    brightness: p.random(40, 80),
                    twinkleSpeed: p.random(0.01, 0.02),
                    twinklePhase: p.random(p.TWO_PI),
                    isBright: p.random() < 0.15 // 15% chance for brighter stars
                });
            }

            canvas.style('z-index', '-1');
            canvas.style('position', 'fixed'); 
            canvas.style('top', '0');
            canvas.style('left', '0');
            p.blendMode(p.SCREEN);
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
            p.background('#0E192B');

            // Draw and update stars
            stars.forEach(star => {
                let primaryTwinkle = p.map(p.sin(p.frameCount * star.twinkleSpeed + star.twinklePhase), -1, 1, 0.8, 1);
                let secondaryTwinkle = p.map(p.sin(p.frameCount * star.twinkleSpeed * 1.5), -1, 1, 0.9, 1);
                let finalTwinkle = primaryTwinkle * secondaryTwinkle;

                // Enhance twinkle for bright stars
                if (star.isBright) {
                    finalTwinkle = p.map(finalTwinkle, 0.8, 1, 0.9, 1.3); // More dramatic twinkle range
                }
                
                p.noStroke();
                // Main star with adjusted opacity for bright stars
                let mainOpacity = star.isBright ? 0.7 : 0.5;
                p.fill(210, 10, star.brightness * finalTwinkle, mainOpacity);
                p.circle(star.x, star.y, star.size * finalTwinkle);
                
                // More subtle glow, slightly enhanced for bright stars
                let glowOpacity = star.isBright ? 0.15 : 0.1;
                let glowSize = star.isBright ? 1.8 : 1.5;
                p.fill(210, 10, star.brightness * finalTwinkle, glowOpacity);
                p.circle(star.x, star.y, star.size * finalTwinkle * glowSize);
            });

            // Maintain single comet with longer lifetime between spawns
            if (comets.length < 1 && p.random(1) < 0.05) {
                let startX = p.random() < 0.5 ? -50 : p.width + 50;
                let startY = p.random(p.height * 0.7);
                let angle = startX < 0 ? 
                    p.random(-p.PI/12, p.PI/12) : 
                    p.random(11*p.PI/12, 13*p.PI/12);
                
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
    constructor(p, x, y, angle, speed = p.random(1.5, 2.5)) {
        this.p = p;
        this.pos = p.createVector(x, y);
        this.vel = p5.Vector.fromAngle(angle);
        this.vel.mult(speed);
        this.history = [];
        this.lifetime = 600;
        this.size = p.random(1.5, 2);
        this.alpha = 1;
    }

    update() {
        this.pos.add(this.vel);
        this.history.push(this.p.createVector(this.pos.x, this.pos.y));
        
        if (this.history.length > 60) {
            this.history.splice(0, 1);
        }
        
        this.lifetime--;
        this.alpha = this.p.map(this.lifetime, 600, 0, 1, 0, true);
    }

    display() {
        this.p.noFill();
        this.p.beginShape();
        for (let i = 0; i < this.history.length; i++) {
            let pos = this.history[i];
            let alpha = this.p.map(i, 0, this.history.length, 0, 1);
            this.p.stroke(210, 10, 100, 0.08 * alpha * this.alpha);
            this.p.vertex(pos.x, pos.y);
        }
        this.p.endShape();
        
        this.p.noStroke();
        this.p.fill(210, 10, 100, 0.6 * this.alpha);
        this.p.circle(this.pos.x, this.pos.y, this.size);
        
        this.p.fill(210, 10, 100, 0.15 * this.alpha);
        this.p.circle(this.pos.x, this.pos.y, this.size * 2);
    }

    isDead() {
        return this.lifetime < 0 || 
               this.pos.x < -100 || 
               this.pos.x > this.p.width + 100 || 
               this.pos.y < -100 || 
               this.pos.y > this.p.height + 100;
    }
}
