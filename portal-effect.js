// Шейдеры в виде строк
const vertexShaderSource = `
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D uCurrentTexture;
    uniform sampler2D uNextTexture;
    uniform float uProgress;
    uniform vec2 uResolution;
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        float progress = uProgress;
        float radius = 0.5;
        vec2 center = vec2(0.5);
        float dist = distance(uv, center);
        float circle = smoothstep(progress * (1.0 + radius), progress * (1.0 - radius), dist);
        vec2 distortedUV = uv + (uv - center) * circle * 0.2;
        vec4 currentColor = texture2D(uCurrentTexture, distortedUV);
        vec4 nextColor = texture2D(uNextTexture, distortedUV);
        gl_FragColor = mix(currentColor, nextColor, circle);
    }
`;

class PortalEffect {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        this.currentTexture = null;
        this.nextTexture = null;
        this.progress = 0;
        
        this.initShaders();
        this.initBuffers();
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
    }

    initShaders() {
        const vertexShader = this.createShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.createShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program');
            return;
        }

        this.gl.useProgram(this.program);

        this.positionLocation = this.gl.getAttribLocation(this.program, 'position');
        this.uvLocation = this.gl.getAttribLocation(this.program, 'uv');
        this.currentTextureLocation = this.gl.getUniformLocation(this.program, 'uCurrentTexture');
        this.nextTextureLocation = this.gl.getUniformLocation(this.program, 'uNextTexture');
        this.progressLocation = this.gl.getUniformLocation(this.program, 'uProgress');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'uResolution');
    }

    createShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    initBuffers() {
        const positions = new Float32Array([
            -1, -1, 0,
             1, -1, 0,
            -1,  1, 0,
             1,  1, 0
        ]);
        
        const uvs = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);

        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.uvBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, uvs, this.gl.STATIC_DRAW);
    }

    loadTexture(url) {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => {
                const texture = this.gl.createTexture();
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                resolve(texture);
            };
            image.src = url;
        });
    }

    async setTextures(currentImageUrl, nextImageUrl) {
        this.currentTexture = await this.loadTexture(currentImageUrl);
        this.nextTexture = await this.loadTexture(nextImageUrl);
    }

    resize() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        }
    }

    render() {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
        this.gl.enableVertexAttribArray(this.uvLocation);
        this.gl.vertexAttribPointer(this.uvLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentTexture);
        this.gl.uniform1i(this.currentTextureLocation, 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
        this.gl.uniform1i(this.nextTextureLocation, 1);

        this.gl.uniform1f(this.progressLocation, this.progress);
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    setProgress(progress) {
        this.progress = progress;
        this.render();
    }
}

// Инициализация эффекта при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const portalSection = document.querySelector('.portal-section');
    if (!portalSection) return;

    // Создаем canvas для WebGL
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '3';
    portalSection.appendChild(canvas);

    // Инициализируем эффект
    const portalEffect = new PortalEffect(canvas);
    window.portalEffect = portalEffect; // Делаем доступным глобально
}); 
