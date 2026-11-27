// Cenas 3D da Lincera (Three.js local).
// 1. Abertura: um celular com a conversa de exemplo acontecendo na tela (o serviço principal).
// 2. Chamada final: o lince low-poly do logo, em volume, olhando para quem visita.
// Sem WebGL, o que fica é a versão em HTML (celular) ou a imagem do logo (lince).
// Com "menos movimento", cada cena aparece parada, no estado final.
import * as THREE from './three.module.min.js';

const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toque = matchMedia('(pointer: coarse)').matches;

// Paleta do specs/design.md (cores do logo do lince)
const COR = {
  tela: '#0A0E19',
  superficie: '#0D1220',
  linha: '#262B38',
  borda: '#2E3546',
  laranja: '#F5A03C',
  branco: '#FFFFFF',
  texto2: '#ABAAA9',
  azul: '#5FF0FF',
};

// ---------------------------------------------------------------- base comum

function criarRenderer(palco) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, toque ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // preserva o laranja da marca
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  palco.appendChild(renderer.domElement);
  return renderer;
}

// Estúdio de luz usado como reflexo: softbox branca em cima, filete laranja à esquerda,
// recorte frio fraco à direita. É o que dá o brilho "de cinema" nas bordas.
function criarEstudio(renderer) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x02040a);
  const painel = (w, h, cor, forca, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    cena.add(m);
  };
  painel(9, 3, '#ffffff', 2.4, [0, 5, 1.5], [Math.PI / 2, 0, 0]);
  painel(1.4, 9, COR.laranja, 7, [-5, 0.5, -0.5], [0, Math.PI / 2.3, 0]);
  painel(2.5, 7, '#a9bcdf', 0.8, [5, 0, 1.5], [0, -Math.PI / 2.2, 0]);
  painel(7, 2, '#ffffff', 0.7, [0, 0.5, 7], [0, Math.PI, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const textura = pmrem.fromScene(cena, 0.04).texture;
  pmrem.dispose();
  return textura;
}

function retanguloArredondado(w, h, r) {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Sombra de contato macia sob o objeto (é luz dentro da cena, não sombra de interface).
function criarSombra(largura, profundidade, opacidade) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, profundidade),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: opacidade, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

// Ponteiro compartilhado: as duas cenas olham levemente para onde o mouse está.
const ponteiro = { x: 0, y: 0 };
if (!toque && !menosMovimento) {
  addEventListener('pointermove', (e) => {
    ponteiro.x = (e.clientX / innerWidth) * 2 - 1;
    ponteiro.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

const facilita = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

// Laço único: só desenha as cenas que estão na tela, e nada com a aba escondida.
const cenas = new Set();
let rodando = false;
function laco(agora) {
  rodando = false;
  if (document.hidden) return;
  let alguma = false;
  for (const c of cenas) {
    if (!c.visivel) continue;
    c.quadro(agora / 1000);
    alguma = true;
  }
  if (alguma && !menosMovimento) pedirQuadro();
}
function pedirQuadro() {
  if (rodando) return;
  rodando = true;
  requestAnimationFrame(laco);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pedirQuadro(); });

function registrar(palco, cena) {
  cenas.add(cena);
  new IntersectionObserver(([e]) => {
    cena.visivel = e.isIntersecting;
    if (cena.visivel) {
      cena.aoAparecer?.();
      pedirQuadro();
    }
  }, { rootMargin: '120px 0px' }).observe(palco);
  new ResizeObserver(() => {
    cena.redimensionar();
    if (menosMovimento || !rodando) cena.quadro(performance.now() / 1000);
  }).observe(palco);
}

// ---------------------------------------------------------------- 1. celular

const CONVERSA = [
  { de: 'cliente', texto: 'Oi! Queria agendar um horário para amanhã.' },
  { de: 'atendimento', texto: 'Olá! Claro. Amanhã tenho horários às 10h, 14h e 16h. Qual fica melhor para você?' },
  { de: 'cliente', texto: '14h, por favor.' },
  { de: 'atendimento', texto: 'Pronto! Seu horário ficou marcado para amanhã às 14h. Até lá!' },
  { de: 'cliente', texto: 'Obrigado!' },
];
// Quando cada mensagem entra (segundos) e quando aparece o "digitando".
const ROTEIRO = { entradas: [0.6, 2.6, 3.8, 6.0, 7.2], digitando: [[1.3, 2.6], [4.5, 6.0]], fim: 11.5 };

function desenhistaDaConversa(largura, altura) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  const g = c.getContext('2d');
  const s = largura / 360; // desenho pensado numa tela de 360 de largura
  const fonte = (peso, px) => `${peso} ${px * s}px "Inter Tight", system-ui, sans-serif`;

  function bolha(x, y, w, h, r, lado) {
    const rr = r * s;
    const pequeno = 4 * s;
    g.beginPath();
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rr);
    const cantoDir = lado === 'cliente' ? pequeno : rr;
    const cantoEsq = lado === 'cliente' ? rr : pequeno;
    g.lineTo(x + w, y + h - cantoDir);
    g.quadraticCurveTo(x + w, y + h, x + w - cantoDir, y + h);
    g.lineTo(x + cantoEsq, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - cantoEsq);
    g.lineTo(x, y + rr);
    g.quadraticCurveTo(x, y, x + rr, y);
    g.closePath();
  }

  function quebrar(texto, max) {
    g.font = fonte(400, 15);
    const palavras = texto.split(' ');
    const linhas = [];
    let atual = '';
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (g.measureText(tentativa).width > max && atual) {
        linhas.push(atual);
        atual = p;
      } else atual = tentativa;
    }
    linhas.push(atual);
    return linhas;
  }

  const MAX = 236 * s, PAD_X = 13 * s, PAD_Y = 10 * s, ALTURA_LINHA = 20.5 * s;
  const medidas = CONVERSA.map((m) => {
    const linhas = quebrar(m.texto, MAX - PAD_X * 2);
    g.font = fonte(400, 15);
    const w = Math.max(...linhas.map((l) => g.measureText(l).width)) + PAD_X * 2;
    return { ...m, linhas, w, h: linhas.length * ALTURA_LINHA + PAD_Y * 2 - 4 * s };
  });

  function cabecalho() {
    g.fillStyle = COR.tela;
    g.fillRect(0, 0, largura, altura);
    // ilha da câmera
    g.fillStyle = '#02050C';
    g.beginPath();
    g.roundRect((largura - 84 * s) / 2, 12 * s, 84 * s, 24 * s, 12 * s);
    g.fill();
    // topo da conversa
    g.fillStyle = COR.azul; // ponto de "online": o azul só em detalhe
    g.beginPath();
    g.arc(26 * s, 74 * s, 4.5 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COR.branco;
    g.font = fonte(500, 15.5);
    g.textBaseline = 'middle';
    g.fillText('Atendimento automático', 40 * s, 74.5 * s);
    g.font = fonte(500, 10);
    const rot = 'EXEMPLO';
    const rw = g.measureText(rot).width + 16 * s;
    g.strokeStyle = COR.linha;
    g.lineWidth = 1.5 * s;
    g.beginPath();
    g.roundRect(largura - 20 * s - rw, 63 * s, rw, 22 * s, 6 * s);
    g.stroke();
    g.fillStyle = COR.texto2;
    g.fillText(rot, largura - 12 * s - rw, 74.5 * s);
    g.fillStyle = COR.linha;
    g.fillRect(0, 100 * s, largura, 1.5 * s);
    // barra de digitar
    const yb = altura - 74 * s;
    g.strokeStyle = COR.linha;
    g.beginPath();
    g.roundRect(16 * s, yb, largura - 76 * s, 42 * s, 21 * s);
    g.stroke();
    g.fillStyle = COR.texto2;
    g.font = fonte(400, 14);
    g.fillText('Mensagem', 32 * s, yb + 21 * s);
    g.fillStyle = COR.laranja;
    g.beginPath();
    g.arc(largura - 37 * s, yb + 21 * s, 18 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COR.superficie;
    g.beginPath(); // seta de enviar
    g.moveTo(largura - 44 * s, yb + 13 * s);
    g.lineTo(largura - 28 * s, yb + 21 * s);
    g.lineTo(largura - 44 * s, yb + 29 * s);
    g.lineTo(largura - 40 * s, yb + 21 * s);
    g.closePath();
    g.fill();
  }

  // t: segundos dentro do roteiro. Devolve true se ainda há algo se mexendo.
  function desenhar(t, tudoPronto = false) {
    cabecalho();
    let y = 120 * s;
    let mexendo = false;
    const sumir = tudoPronto ? 1 : 1 - facilita((t - (ROTEIRO.fim - 1)) / 0.8);
    medidas.forEach((m, i) => {
      const p = tudoPronto ? 1 : facilita((t - ROTEIRO.entradas[i]) / 0.4);
      if (p <= 0) return;
      if (p < 1) mexendo = true;
      const x = m.de === 'cliente' ? largura - 16 * s - m.w : 16 * s;
      g.globalAlpha = p * sumir;
      const dy = (1 - p) * 10 * s;
      bolha(x, y + dy, m.w, m.h, 16, m.de);
      if (m.de === 'cliente') {
        g.fillStyle = COR.linha;
        g.fill();
      } else {
        g.fillStyle = COR.superficie;
        g.fill();
        g.strokeStyle = COR.borda;
        g.lineWidth = 1.5 * s;
        g.stroke();
      }
      g.fillStyle = COR.branco;
      g.font = fonte(400, 15);
      g.textBaseline = 'top';
      m.linhas.forEach((l, k) => g.fillText(l, x + PAD_X, y + dy + PAD_Y + k * ALTURA_LINHA));
      g.textBaseline = 'middle';
      y += m.h + 10 * s;
    });
    // "digitando…": três pontos que pulsam
    if (!tudoPronto) {
      const janela = ROTEIRO.digitando.find(([a, b]) => t >= a && t < b);
      if (janela) {
        mexendo = true;
        g.globalAlpha = facilita((t - janela[0]) / 0.25);
        bolha(16 * s, y, 66 * s, 38 * s, 16, 'atendimento');
        g.fillStyle = COR.superficie;
        g.fill();
        g.strokeStyle = COR.borda;
        g.stroke();
        for (let k = 0; k < 3; k++) {
          const fase = (Math.sin(t * 7 - k * 0.9) + 1) / 2;
          g.globalAlpha = 0.35 + fase * 0.65;
          g.fillStyle = COR.texto2;
          g.beginPath();
          g.arc((33 + k * 16) * s, y + 19 * s - fase * 3 * s, 4 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    if (!tudoPronto && t > ROTEIRO.fim - 1.2) mexendo = true;
    g.globalAlpha = 1;
    return mexendo;
  }

  return { canvas: c, desenhar };
}

async function iniciarCelular(palco) {
  const renderer = criarRenderer(palco);
  if (!renderer) return;

  // Espera a fonte do site para escrever a conversa com ela (no máximo 2,5 s).
  await Promise.race([
    Promise.all([document.fonts.load('400 30px "Inter Tight"'), document.fonts.load('500 30px "Inter Tight"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});

  const cena = new THREE.Scene();
  cena.environment = criarEstudio(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  const W = 1.5, H = 3.08, R = 0.25, D = 0.11, B = 0.035;
  const frente = D / 2 + B;
  const aparelho = new THREE.Group();

  const materialCorpo = new THREE.MeshPhysicalMaterial({
    color: 0x0d1220, metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.25,
  });
  const corpoGeo = new THREE.ExtrudeGeometry(retanguloArredondado(W, H, R), {
    depth: D, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 6, curveSegments: 28,
  });
  corpoGeo.translate(0, 0, -D / 2);
  aparelho.add(new THREE.Mesh(corpoGeo, materialCorpo));

  // botões laterais
  const botao = (y, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.06), materialCorpo);
    m.position.set(W / 2 + B + 0.008, y, 0);
    aparelho.add(m);
  };
  botao(0.75, 0.42);
  botao(0.22, 0.26);

  // tela com a conversa
  const SW = W - 0.09, SH = H - 0.09, SR = R - 0.045;
  const telaGeo = new THREE.ShapeGeometry(retanguloArredondado(SW, SH, SR), 28);
  const pos = telaGeo.attributes.position, uv = telaGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + SW / 2) / SW, (pos.getY(i) + SH / 2) / SH);
  const LT = 720, AT = Math.round((LT * SH) / SW);
  const conversa = desenhistaDaConversa(LT, AT);
  const texturaTela = new THREE.CanvasTexture(conversa.canvas);
  texturaTela.colorSpace = THREE.SRGBColorSpace;
  texturaTela.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const tela = new THREE.Mesh(telaGeo, new THREE.MeshBasicMaterial({ map: texturaTela, toneMapped: false }));
  tela.position.z = frente + 0.002;
  aparelho.add(tela);

  // vidro: só soma o reflexo do estúdio por cima da tela
  const vidro = new THREE.Mesh(telaGeo, new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.05, metalness: 0, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.1,
  }));
  vidro.position.z = frente + 0.004;
  aparelho.add(vidro);

  cena.add(aparelho);
  const sombra = criarSombra(2.6, 0.75, 0.6);
  sombra.position.y = -H / 2 - 0.32;
  cena.add(sombra);

  const BASE = { x: 0.05, y: -0.4, z: 0.035 };
  let inicioEntrada = null;
  let inicioConversa = null;
  const suave = { x: 0, y: 0 };

  function redimensionar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // enquadra o aparelho com folga, pela altura ou pela largura (o que limitar primeiro)
    const meia = THREE.MathUtils.degToRad(camera.fov / 2);
    const porAltura = (H * 1.16) / 2 / Math.tan(meia);
    const porLargura = (W * 2.0) / 2 / (Math.tan(meia) * camera.aspect);
    camera.position.set(0, 0.05, Math.max(porAltura, porLargura));
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
  }

  const cenaObj = {
    visivel: false,
    redimensionar,
    aoAparecer() {
      if (inicioEntrada === null) inicioEntrada = performance.now() / 1000;
    },
    quadro(t) {
      if (menosMovimento) {
        aparelho.rotation.set(BASE.x, BASE.y, BASE.z);
        conversa.desenhar(0, true);
        texturaTela.needsUpdate = true;
        renderer.render(cena, camera);
        return;
      }
      if (inicioEntrada === null) inicioEntrada = t;
      const e = facilita((t - inicioEntrada) / 1.6);
      if (inicioConversa === null && e > 0.55) inicioConversa = t;
      suave.x += (ponteiro.x - suave.x) * 0.05;
      suave.y += (ponteiro.y - suave.y) * 0.05;
      aparelho.rotation.set(
        BASE.x + Math.sin(t * 0.5) * 0.02 + suave.y * 0.08,
        BASE.y - (1 - e) * 0.55 + Math.sin(t * 0.33) * 0.07 + suave.x * 0.18,
        BASE.z,
      );
      aparelho.position.y = -(1 - e) * 0.5 + Math.sin(t * 0.8) * 0.035;
      sombra.material.opacity = 0.6 * e - Math.sin(t * 0.8) * 0.05;
      if (inicioConversa !== null) {
        const tc = (t - inicioConversa) % ROTEIRO.fim;
        if (conversa.desenhar(tc) || !cenaObj.desenhouUmaVez) {
          texturaTela.needsUpdate = true;
          cenaObj.desenhouUmaVez = true;
        }
      } else if (!cenaObj.telaVazia) {
        conversa.desenhar(-1);
        texturaTela.needsUpdate = true;
        cenaObj.telaVazia = true;
      }
      renderer.render(cena, camera);
    },
  };

  redimensionar();
  registrar(palco, cenaObj);
  cenaObj.quadro(performance.now() / 1000);
  palco.classList.add('pronto');
}

// ---------------------------------------------------------------- 2. lince

// Silhueta do logo (assets/logo.png, 540 x 690), tirada do contorno da imagem.
// A frente da peça leva o próprio logo como textura; as laterais e o chanfro são em laranja.
const LINCE_W = 540, LINCE_H = 690;
const LINCE_CONTORNO = [[272, 677.4], [265, 676.5], [138, 624.5], [11.5, 520], [49.4, 401], [80.5, 295], [85.5, 271], [116.4, 107], [116.5, 105], [114.5, 104], [113.5, 95], [110, 12.4], [132.5, 102], [202, 246.6], [271, 225.5], [337, 247.3], [407.5, 101], [428.5, 14], [430, 13], [425.5, 101], [424.9, 104], [422.5, 105], [456.5, 285], [493.5, 413], [523.5, 504], [527.5, 520], [403, 623.3]];
const LINCE_OLHOS = [[195.6, 412.7], [343.6, 412.7]];

function iniciarLince(palco) {
  const renderer = criarRenderer(palco);
  if (!renderer) return;

  const cena = new THREE.Scene();
  cena.environment = criarEstudio(renderer);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);

  const ESCALA = 0.0058;
  const PROF = 46, BEV = 7;
  const forma = new THREE.Shape(LINCE_CONTORNO.map(([x, y]) => new THREE.Vector2(x, -y)));
  // UV da frente = posição no logo; laterais não usam textura
  const uvLogo = {
    generateTopUV(geo, v, a, b, c) {
      return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / LINCE_W, 1 + v[i * 3 + 1] / LINCE_H));
    },
    generateSideWallUV() {
      return [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
    },
  };
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: PROF, bevelEnabled: true, bevelThickness: BEV, bevelSize: 5, bevelSegments: 4, curveSegments: 4, UVGenerator: uvLogo,
  });
  geo.translate(-LINCE_W / 2, LINCE_H / 2 + 20, -PROF / 2);

  const lince = new THREE.Group();
  const textura = new THREE.TextureLoader().load('assets/lince/lince-textura.webp', () => pedirQuadro());
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const frente = new THREE.MeshPhysicalMaterial({
    // a própria textura também ilumina a frente, para as cores do logo não escurecerem
    map: textura, emissive: '#ffffff', emissiveMap: textura, emissiveIntensity: 0.5,
    roughness: 0.45, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.45,
  });
  const lateral = new THREE.MeshPhysicalMaterial({
    color: '#B8641C', roughness: 0.34, metalness: 0.35, clearcoat: 0.5, envMapIntensity: 1.1,
  });
  lince.add(new THREE.Mesh(geo, [frente, lateral]));

  // brilho azul dos olhos, como no logo
  const halo = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(95,240,255,0.75)');
    grad.addColorStop(0.35, 'rgba(95,240,255,0.25)');
    grad.addColorStop(1, 'rgba(95,240,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const olhos = LINCE_OLHOS.map(([x, y]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sp.position.set(x - LINCE_W / 2, -y + LINCE_H / 2 + 20, PROF / 2 + BEV + 2);
    sp.scale.setScalar(70);
    lince.add(sp);
    return sp;
  });

  lince.scale.setScalar(ESCALA);
  cena.add(lince);
  const sombra = criarSombra(3.2, 0.85, 0.55);
  sombra.position.y = -2.25;
  cena.add(sombra);

  const BASE_Y = -0.2;
  let inicio = null;
  const suave = { x: 0, y: 0 };

  function redimensionar() {
    const w = palco.clientWidth, h = palco.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const meia = THREE.MathUtils.degToRad(camera.fov / 2);
    const alto = LINCE_H * ESCALA * 1.28, largo = LINCE_W * ESCALA * 1.5;
    camera.position.set(0, 0.1, Math.max(alto / 2 / Math.tan(meia), largo / 2 / (Math.tan(meia) * camera.aspect)));
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
  }

  const cenaObj = {
    visivel: false,
    redimensionar,
    aoAparecer() {
      if (inicio === null) inicio = performance.now() / 1000;
    },
    quadro(t) {
      if (menosMovimento) {
        lince.rotation.set(0.03, BASE_Y, 0);
        renderer.render(cena, camera);
        return;
      }
      if (inicio === null) inicio = t;
      const e = facilita((t - inicio) / 1.8);
      suave.x += (ponteiro.x - suave.x) * 0.06;
      suave.y += (ponteiro.y - suave.y) * 0.06;
      lince.rotation.set(
        0.03 + Math.sin(t * 0.4) * 0.03 + suave.y * 0.12,
        BASE_Y + (1 - e) * 1.1 + Math.sin(t * 0.45) * 0.22 + suave.x * 0.3,
        0,
      );
      lince.position.y = (1 - e) * -0.35 + Math.sin(t * 0.7) * 0.04;
      const pulso = 70 + Math.sin(t * 1.6) * 6;
      olhos.forEach((o) => o.scale.setScalar(pulso));
      renderer.render(cena, camera);
    },
  };

  redimensionar();
  registrar(palco, cenaObj);
  cenaObj.quadro(performance.now() / 1000);
  palco.classList.add('pronto');
}

// ---------------------------------------------------------------- início

const palcoCelular = document.querySelector('[data-cena="celular"]');
if (palcoCelular) iniciarCelular(palcoCelular);

// O lince só é montado quando a chamada final se aproxima da tela.
const palcoLince = document.querySelector('[data-cena="lince"]');
if (palcoLince) {
  const perto = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    perto.disconnect();
    iniciarLince(palcoLince);
  }, { rootMargin: '600px 0px' });
  perto.observe(palcoLince);
}
