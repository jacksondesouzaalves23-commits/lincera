// Fundo 3D com rolagem — specs/design.md §2 (Fundo 3D)
// Três imagens como planos, uns atrás dos outros. A rolagem leva a câmera para dentro:
// aproxima, gira de leve e atravessa cada plano até o próximo.
import * as THREE from './three.module.min.js';

const fundo = document.querySelector('.fundo');
const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const celular = matchMedia('(max-width: 800px), (pointer: coarse)').matches;

// Com "menos movimento", o fundo fica parado (a imagem estática do CSS).
if (fundo && !menosMovimento) iniciar();

function iniciar() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !celular, alpha: false, powerPreference: 'low-power' });
  } catch {
    return; // Sem WebGL: fica a imagem estática.
  }

  const AZUL_NOITE = 0x080b14;
  const LARANJA = 0xf5a03c;
  const AZUL = 0x5ff0ff;

  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1 : 1.5));
  renderer.setClearColor(AZUL_NOITE, 1);
  fundo.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(AZUL_NOITE, 5, 26); // planos distantes somem no azul-noite
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);

  // Brilho de cada imagem (0–1, como no sRGB). A FundoMeio é a mais clara, então escurece mais.
  const ESPACO = 12;
  const planos = [
    // Topo: maior que a tela desde o início (cobre a 12, com folga para o giro e o deslocamento da câmera),
    // então as bordas e o contorno laranja dele ficam fora de vista.
    { arquivo: 'topo', z: 0, proporcao: 2, brilho: 0.55, giro: 0, cobre: 12, folga: 1.2 },
    { arquivo: 'meio', z: -ESPACO, proporcao: 8736 / 4896, brilho: 0.22, giro: 0.06, detalheAzul: true },
    { arquivo: 'final', z: -ESPACO * 2, proporcao: 1.6, brilho: 1, giro: -0.05 },
  ];

  // Tingimento azul-noite (design.md §6): as imagens não mudam, só a cor com que são desenhadas.
  // TINTA puxa os tons para o azul (valores lineares; a média de luminância fica perto de 1).
  // PISO soma o azul-noite do site, então o preto da imagem vira exatamente #080B14
  // e os escuros caem na faixa #080B14–#0E1424.
  const TINTA = { r: 0.66, g: 0.84, b: 1.5 };
  const PISO = new THREE.Color(AZUL_NOITE); // convertido para linear pelo Three.js
  function tingir(shader) {
    shader.uniforms.piso = { value: PISO };
    shader.fragmentShader = 'uniform vec3 piso;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n\tdiffuseColor.rgb = piso + diffuseColor.rgb * ( vec3( 1.0 ) - piso );',
    );
  }

  const carregador = new THREE.TextureLoader();
  const sufixo = celular ? '-celular' : '';
  let prontos = 0;

  for (const p of planos) {
    p.grupo = new THREE.Group();
    p.grupo.position.z = p.z;
    p.grupo.rotation.z = p.giro;

    // Cor: brilho da imagem × tinta azulada, e os pretos sobem até o azul-noite do site (piso).
    const k = Math.pow(p.brilho, 2.2); // brilho em sRGB → multiplicador linear
    p.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(k * TINTA.r, k * TINTA.g, k * TINTA.b),
      transparent: true,
    });
    p.material.onBeforeCompile = tingir;
    p.imagem = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), p.material);
    p.grupo.add(p.imagem);

    // Luz de contorno laranja: filete fino só na borda de cima e na da direita (luz vinda de trás e da direita).
    p.materialContorno = new THREE.MeshBasicMaterial({ color: LARANJA, transparent: true, opacity: 0.85 });
    p.contornoCima = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), p.materialContorno);
    p.contornoDireita = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), p.materialContorno);
    p.grupo.add(p.contornoCima, p.contornoDireita);

    // Azul só em detalhe: um único ponto pequeno, no canto inferior esquerdo de um plano.
    if (p.detalheAzul) {
      p.materialAzul = new THREE.MeshBasicMaterial({ color: AZUL, transparent: true });
      p.pontoAzul = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), p.materialAzul);
      p.grupo.add(p.pontoAzul);
    }

    cena.add(p.grupo);

    carregador.load(`assets/fundos/${p.arquivo}${sufixo}.jpg`, (textura) => {
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = celular ? 1 : 4;
      p.material.map = textura;
      p.material.needsUpdate = true;
      prontos += 1;
      if (prontos === planos.length) {
        dimensionar();
        acordar();
        fundo.classList.add('pronto');
      }
    });
  }

  // Tamanho dos planos: cada um cobre a tela quando a câmera está a esta distância.
  // De mais longe, ele aparece menor, com preto em volta e o contorno laranja à vista.
  const DISTANCIA_COBRE = celular ? 8 : 9;
  const ESPESSURA = 0.025;

  function dimensionar() {
    const largura = innerWidth, altura = innerHeight;
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();

    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const p of planos) {
      const alturaVista = 2 * (p.cobre ?? DISTANCIA_COBRE) * tangente * (p.folga ?? 1);
      const larguraVista = alturaVista * camera.aspect;
      const h = Math.max(alturaVista, larguraVista / p.proporcao);
      const w = h * p.proporcao;
      p.imagem.scale.set(w, h, 1);
      p.contornoCima.scale.set(w, ESPESSURA, 1);
      p.contornoCima.position.set(0, h / 2, 0.001);
      p.contornoDireita.scale.set(ESPESSURA, h, 1);
      p.contornoDireita.position.set(w / 2, 0, 0.001);
      if (p.pontoAzul) {
        p.pontoAzul.scale.set(0.06, 0.06, 1);
        p.pontoAzul.position.set(-w / 2 + 0.3, -h / 2 + 0.3, 0.002);
      }
    }
    medir();
  }

  // Roteiro da câmera ligado às seções: [posição da rolagem, z da câmera].
  // Topo: aproxima (12 → 4) e atravessa. Meio: aproxima e atravessa. Final: aproxima.
  const CAMINHO_Z = [12, 4, -0.5, -ESPACO + 4, -ESPACO - 0.5, -ESPACO * 2 + 5];
  let marcos = [];
  const topoDe = (seletor) => {
    const el = document.querySelector(seletor);
    return el ? el.getBoundingClientRect().top + scrollY : 0;
  };
  function medir() {
    const fim = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    marcos = [0, topoDe('#como-funciona'), topoDe('#porque'), topoDe('.faixa'), topoDe('#duvidas'), fim]
      .map((y) => Math.min(y, fim));
  }

  function zAlvo() {
    const y = scrollY;
    for (let i = 0; i < marcos.length - 1; i++) {
      const a = marcos[i], b = marcos[i + 1];
      if (y <= b || i === marcos.length - 2) {
        const t = b > a ? THREE.MathUtils.clamp((y - a) / (b - a), 0, 1) : 1;
        const suave = t * t * (3 - 2 * t);
        return THREE.MathUtils.lerp(CAMINHO_Z[i], CAMINHO_Z[i + 1], suave);
      }
    }
    return CAMINHO_Z[0];
  }

  // Aplica a posição: câmera avança, gira de leve; cada plano some ao ser atravessado.
  const Z_INICIO = CAMINHO_Z[0], Z_FIM = CAMINHO_Z[CAMINHO_Z.length - 1];
  function aplicar(z) {
    const progresso = (Z_INICIO - z) / (Z_INICIO - Z_FIM);
    camera.position.set(
      celular ? 0 : 0.35 * Math.sin(progresso * Math.PI * 2),
      celular ? 0 : 0.2 * Math.sin(progresso * Math.PI * 3),
      z,
    );
    camera.rotation.set(
      0,
      celular ? 0 : 0.03 * Math.sin(progresso * Math.PI * 3),
      (celular ? 0.015 : 0.035) * Math.sin(progresso * Math.PI * 2),
    );

    for (const p of planos) {
      const d = z - p.z; // distância até o plano (negativa = já atravessado)
      const visivel = THREE.MathUtils.clamp((d - 0.6) / 2.4, 0, 1);
      p.grupo.visible = visivel > 0;
      p.material.opacity = visivel;
      p.materialContorno.opacity = 0.85 * visivel;
      if (p.materialAzul) p.materialAzul.opacity = visivel;
    }
  }

  // Desenha só enquanto a câmera está se movendo; o movimento segue a rolagem com suavização.
  let zAtual = null, rodando = false, ultimo = 0;
  function quadro(agora) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05);
    ultimo = agora;
    const alvo = zAlvo();
    zAtual = zAtual === null ? alvo : zAtual + (alvo - zAtual) * (1 - Math.exp(-dt * 4));
    aplicar(zAtual);
    renderer.render(cena, camera);
    if (Math.abs(alvo - zAtual) > 0.0005) requestAnimationFrame(quadro);
    else rodando = false;
  }
  function acordar() {
    if (rodando || prontos < planos.length) return;
    rodando = true;
    ultimo = performance.now();
    requestAnimationFrame(quadro);
  }

  addEventListener('scroll', acordar, { passive: true });
  addEventListener('resize', () => { dimensionar(); acordar(); });
  // Se a altura da página mudar (fontes, perguntas abertas), refaz os marcos.
  new ResizeObserver(() => { medir(); acordar(); }).observe(document.body);
}
