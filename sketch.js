var canvas;
var mic;
var body = document.body,
    html = document.documentElement;

let height = Math.min(Math.max( body.scrollHeight, body.offsetHeight,
    html.clientHeight, html.scrollHeight, html.offsetHeight), 1000);
let width = Math.max( body.scrollWidth, body.offsetWidth,
    html.clientWidth, html.scrollWidth, html.offsetWidth );
console.log(height);
let THE_SEED;
let number_of_particles = 100;
let number_of_particle_sets = 4;
let particle_sets = [];
let tick = 0;

let palette;



function setup() {

    canvas = createCanvas(width, height);

    THE_SEED = floor(random(9999999));
    randomSeed(THE_SEED);
    background('#111');

    palette = [
        color(254, 242, 145, 20),
        color(253, 198, 103, 20),
        color(182, 245, 200, 20),
        color(84, 146, 76, 20),
        color(221, 124, 81, 20),
        color(253, 158, 149, 20),
        color(112, 184, 214, 20)
    ];

    for (var j = 0; j < number_of_particle_sets; j++) {
        let ps = [];
        let col = palette[floor(random(palette.length))];
        for (var i = 0; i < number_of_particles; i++) {
            if (j%2 === 0) {
                ps.push(
                    new Particle(randomGaussian(width - 50, 150), randomGaussian(300, 1500), 2, col)
                );
            } else {
                ps.push(
                    new Particle(randomGaussian(50, 150), randomGaussian(300, 1500), 2, col)
                );
            }
        }
        particle_sets.push(ps);
    }

    canvas.background('#0E192B');
    canvas.position(0, 0);
    canvas.style('z-index', '-1');

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function draw() {
    particle_sets.forEach(function(particles, index) {
        particles.forEach(function(particle) {
            for(j=0; j<1; j++) {
                particle.update(index);
                particle.display(index);
                sleep(1500)
            }
        });
    });
}

class Particle {
    constructor(x, y, phi, col) {
        this.pos = createVector(x, y);
        this.altitude = 0;
        this.val = 0;
        this.angle = phi;
        this.col = col;
    }

    update(index) {
        this.pos.x += cos(this.angle);
        this.pos.y += sin(this.angle);

        let nx = 1.1 * map(this.pos.y, 0, height, 4, 0.2) * map(this.pos.x, 0, width, -1, 1);
        let ny = 3.1 * map(this.pos.y, 0, height, 4, 0.2) * map(this.pos.y, 0, height, -1, 1);

        this.altitude = noise(nx + 423.2, ny - 231.1);
        this.val = (this.altitude + 0.035 * (index - number_of_particle_sets / 2)) % 1;
        this.angle += 3 * map(this.val, 0, 1, -1, 1);
    }

    display(index) {
        if (this.val > 0.485 && this.val < 0.515) {
            stroke(this.col);
            push();
            translate(this.pos.x, this.pos.y + 50 - this.altitude * 100 * map(this.pos.y, 0, height, 3, 4));
            rotate(this.angle);
            point(0, 0);
            pop();
        }
    }
};
