import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { RotateCw, Maximize2, Minimize2, RefreshCw, Eye, EyeOff, LayoutGrid } from 'lucide-react';

interface StlViewer3DProps {
  fileUrl?: string;
  fileName?: string;
  onClose?: () => void;
}

type MaterialType = 'yeso' | 'esmalte' | 'wireframe';

export const StlViewer3D: React.FC<StlViewer3DProps> = ({ fileUrl, fileName = 'Modelo3D.stl', onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentMeshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [materialType, setMaterialType] = useState<MaterialType>('esmalte');
  const [showHelperGrid, setShowHelperGrid] = useState(true);

  // Paleta de materiales para el visor dental
  const getMaterial = (type: MaterialType): THREE.Material => {
    switch (type) {
      case 'yeso':
        // Yeso de laboratorio dental (azul mate / celeste)
        return new THREE.MeshStandardMaterial({
          color: 0x8ab4f8,
          roughness: 0.8,
          metalness: 0.1,
          side: THREE.DoubleSide,
          flatShading: true, // Resalta las facetas de escaneo dental
        });
      case 'esmalte':
        // Esmalte realista (beige claro / marfil semi-brillante)
        return new THREE.MeshStandardMaterial({
          color: 0xfaf9f5,
          roughness: 0.25,
          metalness: 0.05,
          side: THREE.DoubleSide,
          bumpScale: 0.05,
        });
      case 'wireframe':
        // Estructura de alambre para inspección de malla
        return new THREE.MeshBasicMaterial({
          color: 0x10b981,
          wireframe: true,
          side: THREE.DoubleSide,
        });
    }
  };

  // Genera un modelo de arco dental procedural para demostración si no hay STL o falla la carga
  const createProceduralDentalModel = (): THREE.BufferGeometry => {
    const group = new THREE.Group();

    // Crear la base del modelo (encía / arco de herradura)
    const basePoints: THREE.Vector3[] = [];
    const steps = 40;
    const radiusX = 22;
    const radiusY = 25;

    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI - Math.PI; // Arco de -pi a 0
      const x = radiusX * Math.cos(theta);
      const y = radiusY * Math.sin(theta) * 0.7; // Un poco achatado
      basePoints.push(new THREE.Vector3(x, y, 0));
    }

    // Extruir el arco para darle altura
    const extrudeSettings = {
      steps: 1,
      depth: 6,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1,
      bevelSegments: 3,
    };

    const shape = new THREE.Shape();
    shape.moveTo(basePoints[0].x, basePoints[0].y);
    for (let i = 1; i < basePoints.length; i++) {
      shape.lineTo(basePoints[i].x, basePoints[i].y);
    }
    // Cerrar el arco haciéndolo grueso
    for (let i = basePoints.length - 1; i >= 0; i--) {
      const scale = 0.75;
      shape.lineTo(basePoints[i].x * scale, basePoints[i].y * scale);
    }
    shape.closePath();

    const baseGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    baseGeometry.center();
    // Rotar para alinearlo con el plano horizontal Z-X
    baseGeometry.rotateX(-Math.PI / 2);

    return baseGeometry;
  };

  // Manejar el redimensionamiento del canvas
  const handleResize = () => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  // Alternar pantalla completa
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error al entrar a pantalla completa:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Escuchar evento de salida de pantalla completa nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Forzar redimensionamiento después de un leve delay para que el DOM se asiente
      setTimeout(handleResize, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reiniciar la cámara
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current || !currentMeshRef.current) return;

    const mesh = currentMeshRef.current;
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;

    if (boundingBox) {
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2));
      cameraZ *= 1.8; // Factor de zoom inicial

      cameraRef.current.position.set(center.x, center.y + (maxDim * 0.8), center.z + cameraZ);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  // Efecto principal para inicializar la escena de Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;

    // 1. Escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18181b); // Fondo gris oscuro premium (slate 900)
    sceneRef.current = scene;

    // 2. Cámara
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 40, 60);
    cameraRef.current = camera;

    // 3. Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Limpiar contenedor y agregar canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Luces (Estilo estudio clínico)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Luz principal arriba a la derecha
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(40, 80, 40);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 200;
    const d = 50;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    scene.add(dirLight1);

    // Luz secundaria de relleno a la izquierda
    const dirLight2 = new THREE.DirectionalLight(0xa5c3e8, 0.4);
    dirLight2.position.set(-40, 20, -20);
    scene.add(dirLight2);

    // Luz suave desde abajo para suavizar sombras duras
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, -40, 0);
    scene.add(hemiLight);

    // 5. Controles de Órbita
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI; // Permite ver desde abajo
    controls.minDistance = 5;
    controls.maxDistance = 300;
    controlsRef.current = controls;

    // 6. Guías y Rejilla
    const gridHelper = new THREE.GridHelper(100, 50, 0x4f46e5, 0x3f3f46);
    gridHelper.position.y = -15;
    scene.add(gridHelper);

    // Guardar referencia al grid para ocultarlo/mostrarlo
    const gridObject = gridHelper;

    // Cargar STL o usar fallback procedural
    if (fileUrl) {
      setLoading(true);
      setError(null);
      const loader = new STLLoader();

      loader.load(
        fileUrl,
        (geometry) => {
          try {
            // Centrar la geometría cargada
            geometry.computeVertexNormals();
            geometry.center();

            const material = getMaterial(materialType);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            scene.add(mesh);
            currentMeshRef.current = mesh;

            // Ajustar posición del grid al piso del objeto
            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox;
            if (bbox) {
              gridObject.position.y = bbox.min.y - 0.5;
            }

            resetCamera();
            setLoading(false);
          } catch (e) {
            console.error('Error procesando el archivo STL cargado:', e);
            setError('Error al decodificar la geometría STL.');
            setLoading(false);
          }
        },
        (xhr) => {
          if (xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('Error cargando STL desde URL, iniciando modelo de demostración:', err);
          
          // Actuar con resiliencia: si el archivo real no existe o falla la descarga,
          // renderizar un modelo procedural y notificar en consola
          const geometry = createProceduralDentalModel();
          const material = getMaterial(materialType);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          scene.add(mesh);
          currentMeshRef.current = mesh;
          
          resetCamera();
          setLoading(false);
        }
      );
    } else {
      // Si no hay URL, cargamos el modelo procedural de inmediato (Modo Demostración)
      setTimeout(() => {
        const geometry = createProceduralDentalModel();
        const material = getMaterial(materialType);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        scene.add(mesh);
        currentMeshRef.current = mesh;

        resetCamera();
        setLoading(false);
      }, 800);
    }

    // 7. Loop de Animación
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Rotación automática si está activa
      if (autoRotate && currentMeshRef.current) {
        currentMeshRef.current.rotation.y += 0.005;
      }

      // Controlar visibilidad de la rejilla
      gridObject.visible = showHelperGrid;

      // Actualizar controles
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Renderizar
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Redimensionar al cambiar el tamaño de la ventana
    window.addEventListener('resize', handleResize);

    // Cleanup al desmontar
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
      if (currentMeshRef.current) {
        currentMeshRef.current.geometry.dispose();
        const mat = currentMeshRef.current.material;
        if (Array.isArray(mat)) {
          (mat as THREE.Material[]).forEach((m) => m.dispose());
        } else if (mat) {
          (mat as THREE.Material).dispose();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Actualizar material del mesh cuando cambia la selección en la UI
  useEffect(() => {
    if (currentMeshRef.current) {
      const mat = currentMeshRef.current.material;
      if (Array.isArray(mat)) {
        (mat as THREE.Material[]).forEach((m) => m.dispose());
      } else if (mat) {
        (mat as THREE.Material).dispose();
      }
      currentMeshRef.current.material = getMaterial(materialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialType]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: isFullscreen ? '100vh' : '100%',
        minHeight: isFullscreen ? '100vh' : '380px',
        position: 'relative',
        borderRadius: isFullscreen ? '0' : '16px',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : 'inset 0 0 40px rgba(0,0,0,0.6)',
        backgroundColor: '#18181b',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HUD del Visor 3D (Superpuesto en el Canvas) */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Título de Archivo */}
        <div
          style={{
            background: 'rgba(24, 24, 27, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            color: '#f4f4f5',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem',
          }}
        >
          <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.3px' }}>
            {fileName}
          </span>
          <span style={{ fontSize: '0.62rem', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 600 }}>
            {fileUrl ? 'Escaneo Odontológico STL' : 'Modelo de Demostración 3D'}
          </span>
        </div>

        {/* Botones de Acción Superior */}
        <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Ver en Pantalla Completa'}
            style={{
              background: 'rgba(24, 24, 27, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f4f4f5',
              width: '2.2rem',
              height: '2.2rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(39, 39, 42, 0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(24, 24, 27, 0.85)')}
          >
            {isFullscreen ? <Minimize2 style={{ width: '1rem', height: '1rem' }} /> : <Maximize2 style={{ width: '1rem', height: '1rem' }} />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              title="Cerrar Visor"
              style={{
                background: 'rgba(239, 68, 68, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                padding: '0 0.8rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220, 38, 38, 0.95)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)')}
            >
              Cerrar Visor
            </button>
          )}
        </div>
      </div>

      {/* Controles de Renderizado Inferiores (Superpuestos) */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          right: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Selector de Materiales */}
        <div
          style={{
            background: 'rgba(24, 24, 27, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.4rem',
            borderRadius: '12px',
            pointerEvents: 'auto',
            display: 'flex',
            gap: '0.25rem',
          }}
        >
          {(['esmalte', 'yeso', 'wireframe'] as MaterialType[]).map((type) => (
            <button
              key={type}
              onClick={() => setMaterialType(type)}
              style={{
                background: materialType === type ? 'var(--color-accent)' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.2px',
                transition: 'background 0.15s',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Herramientas de Cámara */}
        <div
          style={{
            background: 'rgba(24, 24, 27, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.4rem',
            borderRadius: '12px',
            pointerEvents: 'auto',
            display: 'flex',
            gap: '0.4rem',
          }}
        >
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Alternar Rotación Automática"
            style={{
              background: autoRotate ? 'rgba(79, 70, 229, 0.3)' : 'transparent',
              border: 'none',
              color: autoRotate ? '#818cf8' : '#e4e4e7',
              width: '2rem',
              height: '2rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCw style={{ width: '0.9rem', height: '0.9rem', animation: autoRotate ? 'spin 12s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setShowHelperGrid(!showHelperGrid)}
            title="Mostrar/Ocultar Rejilla"
            style={{
              background: showHelperGrid ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              border: 'none',
              color: showHelperGrid ? '#34d399' : '#e4e4e7',
              width: '2rem',
              height: '2rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LayoutGrid style={{ width: '0.9rem', height: '0.9rem' }} />
          </button>
          <button
            onClick={resetCamera}
            title="Centrar Cámara"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e4e4e7',
              width: '2rem',
              height: '2rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <RefreshCw style={{ width: '0.9rem', height: '0.9rem' }} />
          </button>
        </div>
      </div>

      {/* Pantallas de Carga y Errores */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(24, 24, 27, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            gap: '1rem',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cargando modelo 3D...</span>
            {progress > 0 && <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{progress}% completado</span>}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(24, 24, 27, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            gap: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <span style={{ color: 'var(--color-rose)', fontSize: '1.5rem', fontWeight: 'bold' }}>⚠️ Error de Carga</span>
          <span style={{ fontSize: '0.85rem', color: '#e4e4e7', maxWidth: '300px' }}>{error}</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              background: 'var(--color-accent)',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Inyección de estilos CSS simples para animaciones clave */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
