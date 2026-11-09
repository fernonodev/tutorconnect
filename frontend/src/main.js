import './style.css';
import Swal from 'sweetalert2';
import { tutorService } from './services/tutorService.js';
import { showToast, toggleButtonLoading } from './utils/alerts.js';

let currentUser = JSON.parse(localStorage.getItem('user')) || null;

const app = document.getElementById('app');
const navLinks = document.getElementById('nav-links');
const userBadge = document.getElementById('user-profile-badge');

// Exportar funciones principales a window para invocación global desde HTML
window.renderLoginView = renderLogin;
window.renderRegisterView = renderRegister;

function renderNav() {
  if (!navLinks || !userBadge) return;

  if (!currentUser) {
    // Si no hay sesión iniciada, se deja el nav de enlaces limpio
    navLinks.innerHTML = '';
    userBadge.innerHTML = '';
    return;
  }

  let html = `
    <button class="btn" onclick="window.renderCatalog()">Catálogo Tutores</button>
    <button class="btn" onclick="window.renderMisCitas()">Mis Tutorías</button>
  `;

  // Habilitar Panel de Tutor si el usuario es tutor
  if (currentUser.es_tutor || currentUser.rol === 'Tutor') {
    html += `<button class="btn" onclick="window.renderPanelTutor()">Panel Tutor</button>`;
  }

  if (currentUser.rol === 'Admin') {
    html += `<button class="btn btn-danger" onclick="window.renderAuditoria()">Auditoría</button>`;
  }

  if (!currentUser.es_tutor && currentUser.rol === 'Estudiante') {
    html += `<button class="btn btn-success" onclick="window.renderPostularTutor()">Ser Tutor</button>`;
  }

  navLinks.innerHTML = html;
  userBadge.innerHTML = `
    <span>${currentUser.nombres} (${currentUser.rol})</span>
    <button class="btn btn-danger" style="margin-left:10px" id="btn-logout">Salir</button>
  `;

  document.getElementById('btn-logout').onclick = logout;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  renderNav();
  renderLogin();
}

function renderLogin() {
  app.innerHTML = `
    <div class="card" style="max-width: 400px; margin: auto;">
      <h3 style="color: #004085; text-align: center; margin-bottom: 1rem;">Iniciar Sesión</h3>
      <form id="form-login">
        <input type="email" id="login-email" placeholder="Correo institucional / personal" required style="width:100%; padding:0.5rem; margin-bottom:1rem; border:1px solid #ccc; border-radius:4px;">
        <input type="password" id="login-pass" placeholder="Contraseña" required style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border:1px solid #ccc; border-radius:4px;">
        
        <p style="text-align: right; margin-bottom: 1rem;">
          <a href="#" id="link-forgot-password" style="font-size: 0.85rem; color: #555;">¿Olvidaste tu contraseña?</a>
        </p>

        <button type="submit" class="btn btn-primary" style="width:100%" id="btn-submit-login">Entrar</button>
      </form>
      <p style="margin-top: 1rem; text-align: center; font-size: 0.9rem;">
        ¿No tienes cuenta? <a href="#" id="link-go-register" style="color: #004085; font-weight: bold;">Regístrate aquí</a>
      </p>
    </div>
  `;

  document.getElementById('link-forgot-password').onclick = (e) => {
    e.preventDefault();
    Swal.fire({
      title: 'Recuperar Contraseña',
      text: 'Ingresa tu correo institucional para recibir las instrucciones:',
      input: 'email',
      inputPlaceholder: 'usuario@fp-unves.edu.py',
      showCancelButton: true,
      confirmButtonText: 'Enviar Instrucciones',
      cancelButtonText: 'Cancelar',
      showLoaderOnConfirm: true,
      preConfirm: async (email) => {
        try {
          return await tutorService.forgotPassword(email);
        } catch (error) {
          Swal.showValidationMessage(error.message);
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        showToast('success', result.value.message);
      }
    });
  };

  document.getElementById('link-go-register').onclick = (e) => {
    e.preventDefault();
    renderRegister();
  };

  document.getElementById('form-login').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-login');
    toggleButtonLoading(btn, true);
    try {
      const res = await tutorService.login(
        document.getElementById('login-email').value,
        document.getElementById('login-pass').value
      );
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('user', JSON.stringify(res.user));
      currentUser = res.user;
      renderNav();
      window.renderCatalog();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      toggleButtonLoading(btn, false, 'Entrar');
    }
  };
}

function renderResetPasswordView(token) {
  app.innerHTML = `
    <div class="card" style="max-width: 420px; margin: 3rem auto; padding: 2rem;">
      <h3 style="margin-bottom: 0.5rem; color: #004085; text-align: center;">Nueva Contraseña</h3>
      <p style="font-size: 0.9rem; color: #555; margin-bottom: 1.5rem; text-align: center;">
        Ingresa tu nueva contraseña para actualizar el acceso a TutorConnect.
      </p>
      
      <form id="form-reset-password">
        <div style="margin-bottom: 1rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Nueva contraseña:</label>
          <input type="password" id="reset-password-input" placeholder="Mínimo 6 caracteres" required style="width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Confirmar contraseña:</label>
          <input type="password" id="reset-password-confirm" placeholder="Repite tu nueva contraseña" required style="width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px;">
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.7rem;" id="btn-save-pass">
          Actualizar Contraseña
        </button>
      </form>
    </div>
  `;

  document.getElementById('form-reset-password').onsubmit = async (e) => {
    e.preventDefault();
    const pass = document.getElementById('reset-password-input').value;
    const confirmPass = document.getElementById('reset-password-confirm').value;

    if (pass !== confirmPass) {
      showToast('error', 'Las contraseñas no coinciden.');
      return;
    }

    const btn = document.getElementById('btn-save-pass');
    toggleButtonLoading(btn, true);

    try {
      const res = await tutorService.resetPassword(token, pass);
      Swal.fire({
        icon: 'success',
        title: '¡Contraseña actualizada!',
        text: res.message || 'Ya puedes iniciar sesión con tu nueva contraseña.',
        confirmButtonColor: '#004085'
      }).then(() => {
        window.location.hash = '';
        renderLogin();
      });
    } catch (err) {
      showToast('error', err.message);
      toggleButtonLoading(btn, false, 'Actualizar Contraseña');
    }
  };
}

function renderRegister() {
  app.innerHTML = `
    <div class="card" style="max-width: 400px; margin: auto;">
      <h3 style="color: #004085; text-align: center; margin-bottom: 0.5rem;">Registro de Estudiante</h3>
      <p style="font-size: 0.85rem; color: #555; margin-bottom: 1rem;">
        Completa tus datos para crear tu cuenta en la FP-UNVES. Si deseas ser tutor, podrás postularte desde tu panel una vez registrado.
      </p>
      <form id="form-register">
        <input type="text" id="reg-nombres" placeholder="Nombres" required style="width:100%; padding:0.5rem; margin-bottom:1rem; border:1px solid #ccc; border-radius:4px;">
        <input type="text" id="reg-apellidos" placeholder="Apellidos" required style="width:100%; padding:0.5rem; margin-bottom:1rem; border:1px solid #ccc; border-radius:4px;">
        <input type="email" id="reg-email" placeholder="Correo electrónico" required style="width:100%; padding:0.5rem; margin-bottom:1rem; border:1px solid #ccc; border-radius:4px;">
        <input type="password" id="reg-pass" placeholder="Contraseña (mín. 6 caracteres)" required style="width:100%; padding:0.5rem; margin-bottom:1rem; border:1px solid #ccc; border-radius:4px;">
        <label style="display:block; font-size:0.85rem; margin-bottom:0.3rem;">Carrera FP-UNVES:</label>
        <select id="reg-carrera" class="btn" style="width:100%; border:1px solid #ccc; margin-bottom:1rem; padding:0.5rem;">
          <option value="1">Ingeniería en Sistemas Informáticos</option>
          <option value="2">Ingeniería Eléctrica</option>
        </select>
        <button type="submit" class="btn btn-success" style="width:100%" id="btn-submit-reg">Crear Cuenta</button>
      </form>
      <p style="margin-top: 1rem; text-align: center; font-size: 0.9rem;">
        ¿Ya tienes cuenta? <a href="#" id="link-go-login" style="color: #004085; font-weight: bold;">Inicia sesión aquí</a>
      </p>
    </div>
  `;

  document.getElementById('link-go-login').onclick = (e) => {
    e.preventDefault();
    renderLogin();
  };

  document.getElementById('form-register').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-reg');
    toggleButtonLoading(btn, true);
    try {
      const payload = {
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-pass').value,
        carrera_id_carrera: parseInt(document.getElementById('reg-carrera').value)
      };
      await tutorService.register(payload);
      showToast('success', 'Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
      renderLogin();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      toggleButtonLoading(btn, false, 'Crear Cuenta');
    }
  };
}

window.renderCatalog = async () => {
  app.innerHTML = `
    <div class="card">
      <h3 style="color: #004085; margin-bottom: 1rem;">Catálogo de Tutores Académicos - FP UNVES</h3>
      <div style="display:flex; gap:10px; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <select id="filter-carrera" class="btn" style="border: 1px solid #ccc; padding: 0.5rem;">
          <option value="">Todas las Carreras</option>
          <option value="1">Ingeniería en Sistemas Informáticos</option>
          <option value="2">Ingeniería Eléctrica</option>
        </select>
        <input type="text" id="filter-q" placeholder="Buscar tutor por nombre o apellido..." style="padding: 0.5rem; flex: 1; border: 1px solid #ccc; border-radius: 4px;" />
        <button class="btn btn-primary" id="btn-buscar">Filtrar</button>
      </div>
      <div id="tutores-grid" class="grid-tutores" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
        Cargando tutores...
      </div>
    </div>
  `;

  const fetchAndRender = async () => {
    try {
      const carrera = document.getElementById('filter-carrera').value;
      const q = document.getElementById('filter-q').value;
      const tutores = await tutorService.getTutores(carrera, q);
      const grid = document.getElementById('tutores-grid');

      if (!tutores || !tutores.length) {
        grid.innerHTML = '<p style="grid-column: 1/-1; color: #666;">No se encontraron tutores disponibles.</p>';
        return;
      }

      grid.innerHTML = tutores.map(t => {
        const nombreCarrera = t.estudiante && t.estudiante.carrera 
          ? (typeof t.estudiante.carrera === 'object' ? t.estudiante.carrera.nombre : t.estudiante.carrera)
          : 'FP-UNVES';
        
        const esRemunerado = String(t.tipo_honorario || '').trim().toLowerCase() === 'remunerado';
        const textoHonorario = esRemunerado
          ? `Remunerado (Gs. ${Number(t.tarifa_hora || 0).toLocaleString('es-PY')}/hs)`
          : 'Voluntario';
        
        // Cálculo del Rating DENTRO del map para cada tutor 't'
        const totalResenas = t.total_resenas || 0;
        const ratingPromedio = t.rating_promedio || 0;
        const textoRating = totalResenas > 0 
          ? `⭐ ${Number(ratingPromedio).toFixed(1)} / 5.0 (${totalResenas} reseña${totalResenas > 1 ? 's' : ''})`
          : '⭐ Sin calificaciones';

        // Serialización segura del objeto tutor completo para pasar a la modal
        const tutorJson = JSON.stringify(t).replace(/"/g, '&quot;');

        return `
          <div class="card" style="border-top: 4px solid #004085; background: #fff; padding: 1.2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h4 style="margin-bottom: 0.5rem; color: #004085;">${t.estudiante.nombres} ${t.estudiante.apellidos}</h4>
            <p style="margin-bottom: 0.3rem;"><strong>Carrera:</strong> ${nombreCarrera}</p>
            <p style="margin-bottom: 0.3rem;"><strong>Promedio Académico:</strong> ${t.promedio.toFixed(2)}</p>
            <p style="margin-bottom: 0.3rem;"><strong>Modalidad Honorario:</strong> ${textoHonorario}</p>
            <p style="margin-bottom: 1rem;"><strong>Calificación:</strong> ${textoRating}</p>
            <button class="btn btn-success" style="width: 100%;" onclick="window.solicitarCitaModal(${tutorJson})">Solicitar Cita</button>
          </div>
        `;
      }).join('');
    } catch (err) {
      showToast('error', err.message);
    }
  };

  document.getElementById('btn-buscar').onclick = fetchAndRender;
  fetchAndRender();
};

window.solicitarCitaModal = (tutorParam, nombreParam, tipoParam, tarifaParam) => {
  if (!currentUser) {
    showToast('info', 'Debe iniciar sesión para solicitar una tutoría.');
    return;
  }

  let idTutor, tutorNombre, tipoHonorario, tarifaHora, totalResenas, ratingPromedio;

  // 1. Extraer los datos de forma segura según el tipo de argumento recibido
  if (typeof tutorParam === 'object' && tutorParam !== null) {
    idTutor = tutorParam.id_tutor || tutorParam.id;
    tutorNombre = tutorParam.estudiante 
      ? `${tutorParam.estudiante.nombres} ${tutorParam.estudiante.apellidos}`
      : (tutorParam.nombre_completo || 'Tutor');
    tipoHonorario = tutorParam.tipo_honorario || (tutorParam.perfil_tutor && tutorParam.perfil_tutor.tipo_honorario);
    tarifaHora = tutorParam.tarifa_hora !== undefined ? tutorParam.tarifa_hora : (tutorParam.perfil_tutor ? tutorParam.perfil_tutor.tarifa_hora : 0);
    totalResenas = tutorParam.total_resenas !== undefined ? tutorParam.total_resenas : 0;
    ratingPromedio = tutorParam.rating_promedio !== undefined ? tutorParam.rating_promedio : 0;
  } else {
    idTutor = tutorParam;
    tutorNombre = nombreParam;
    tipoHonorario = tipoParam;
    tarifaHora = tarifaParam;
    totalResenas = 0;
    ratingPromedio = 0;
  }

  // 2. Formatear la tarifa y la calificación del tutor
  const esRemunerado = String(tipoHonorario || '').trim().toLowerCase() === 'remunerado';
  const textoTarifa = esRemunerado 
    ? `Gs. ${Number(tarifaHora || 0).toLocaleString('es-PY')} / hora`
    : 'Voluntario (Gratuito)';
  const badgeColor = esRemunerado ? '#28a745' : '#17a2b8';

  const textoRating = totalResenas > 0 
    ? `⭐ ${Number(ratingPromedio).toFixed(1)} / 5.0 (${totalResenas} reseña${totalResenas > 1 ? 's' : ''})`
    : '⭐ Sin calificaciones';

  // 3. Renderizar Modal con SweetAlert2
  Swal.fire({
    title: `Agendar Cita con ${tutorNombre}`,
    html: `
      <!-- Banner Informativo: Honorario + Rating -->
      <div style="background: #f8f9fa; border-left: 4px solid ${badgeColor}; padding: 12px; margin-bottom: 15px; border-radius: 4px; text-align: left;">
        <span style="font-size: 0.75rem; color: #666; display: block; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Información del Tutor:</span>
        <div style="font-size: 1rem; color: #333; display: flex; flex-direction: column; gap: 4px;">
          <div><strong>Honorario:</strong> <span style="color: ${badgeColor}; font-weight: bold;">${textoTarifa}</span></div>
          <div><strong>Calificación:</strong> <span style="font-weight: bold;">${textoRating}</span></div>
        </div>
      </div>

      <input type="text" id="swal-materia" class="swal2-input" placeholder="Materia / Tema a tratar">
      <select id="swal-modalidad" class="swal2-input">
        <option value="Presencial">Presencial</option>
        <option value="Virtual">Virtual</option>
      </select>
      <input type="text" id="swal-lugar" class="swal2-input" placeholder="Aula (Presencial) o Enlace Google Meet (Virtual)">
      <label style="display:block; text-align:left; margin-top:10px; font-weight:500;">Fecha y Hora Inicio:</label>
      <input type="datetime-local" id="swal-inicio" class="swal2-input">
      <label style="display:block; text-align:left; margin-top:10px; font-weight:500;">Fecha y Hora Fin:</label>
      <input type="datetime-local" id="swal-fin" class="swal2-input">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Confirmar Reserva',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const materia_tema = document.getElementById('swal-materia').value;
      const modalidad = document.getElementById('swal-modalidad').value;
      const lugar_link = document.getElementById('swal-lugar').value;
      const inicio = document.getElementById('swal-inicio').value;
      const fin = document.getElementById('swal-fin').value;

      if (!materia_tema || !lugar_link || !inicio || !fin) {
        Swal.showValidationMessage('Todos los campos son obligatorios');
        return false;
      }
      return { 
        tutor_id_tutor: idTutor, 
        materia_tema, 
        modalidad, 
        lugar_link, 
        fecha_hora_inicio: new Date(inicio).toISOString(), 
        fecha_hora_fin: new Date(fin).toISOString() 
      };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await tutorService.crearCita(result.value);
        showToast('success', 'Solicitud de cita registrada con éxito.');
      } catch (err) {
        showToast('error', err.message);
      }
    }
  });
};

window.renderPostularTutor = () => {
  app.innerHTML = `
    <div class="card" style="max-width: 600px; margin: auto;">
      <h3 style="color: #004085; margin-bottom: 0.5rem;">Postulación para Tutor Académico</h3>
      <p style="font-size: 0.9rem; color: #555; margin-bottom: 1.5rem;">
        Requisito institucional: Poseer un promedio general igual o mayor a 4.0. Adjunte su ficha académica para verificación OCR.
      </p>
      <form id="form-postular">
        <!-- 1. SELECCIÓN DE CARRERA -->
        <div style="margin-bottom: 1rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Carrera de la FP-UNVES:</label>
          <select id="postular-carrera" class="btn" style="width:100%; border:1px solid #ccc; padding:0.5rem;" onchange="window.cargarMateriasCarrera(this.value)">
            <option value="">-- Seleccionar Carrera --</option>
            <option value="1">Ingeniería en Sistemas Informáticos</option>
            <option value="2">Ingeniería Eléctrica</option>
          </select>
        </div>

        <!-- 2. CONTENEDOR DINÁMICO DE MATERIAS -->
        <div id="box-materias" style="margin-bottom: 1rem; display: none;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Materias que puedes enseñar:</label>
          <div id="lista-materias-checkboxes" style="max-height: 180px; overflow-y: auto; border: 1px solid #ccc; padding: 0.8rem; border-radius: 4px; background: #fafafa;">
            Cargando materias...
          </div>
          <small style="color: #666; display: block; margin-top: 4px;">Marca una o varias materias de tu carrera.</small>
        </div>

        <!-- 3. TIPO DE HONORARIO Y FICHA -->
        <div style="margin-bottom: 1rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Tipo de Honorario Inicial:</label>
          <select id="tipo_honorario" class="btn" style="width:100%; border:1px solid #ccc; padding:0.5rem;">
            <option value="Voluntario">Voluntario</option>
            <option value="Remunerado">Remunerado</option>
          </select>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Ficha Académica (Imagen / Escáner):</label>
          <input type="file" id="ficha_file" accept="image/*" required style="width:100%" />
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%; padding:0.7rem;" id="btn-submit-postular">
          Subir y Analizar Ficha
        </button>
      </form>
    </div>
  `;

  document.getElementById('form-postular').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-postular');
    
    // Extraer los IDs de las materias marcadas en los checkboxes
    const checkboxes = document.querySelectorAll('.materia-checkbox:checked');
    const materiasIds = Array.from(checkboxes).map(cb => cb.value).join(',');

    const formData = new FormData();
    formData.append('tipo_honorario', document.getElementById('tipo_honorario').value);
    formData.append('materias_ids', materiasIds);
    formData.append('ficha', document.getElementById('ficha_file').files[0]);

    toggleButtonLoading(btn, true);
    try {
      const tutor = await tutorService.solicitarSerTutor(formData);
      showToast('success', `¡Aprobado! Promedio detectado: ${tutor.promedio}`);
      currentUser.es_tutor = true;
      currentUser.rol = 'Tutor';
      localStorage.setItem('user', JSON.stringify(currentUser));
      renderNav();
      window.renderCatalog();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      toggleButtonLoading(btn, false, 'Subir y Analizar Ficha');
    }
  };
};

// Carga asíncrona de materias por carrera mediante la API
window.cargarMateriasCarrera = async (carreraId) => {
  const box = document.getElementById('box-materias');
  const container = document.getElementById('lista-materias-checkboxes');
  
  if (!carreraId) {
    box.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  box.style.display = 'block';
  container.innerHTML = 'Cargando materias...';

  try {
    const materias = await tutorService.getMateriasPorCarrera(carreraId);
    if (!materias || materias.length === 0) {
      container.innerHTML = '<p style="color: #666; font-size: 0.85rem;">No hay materias disponibles para esta carrera.</p>';
      return;
    }

    container.innerHTML = materias.map(m => `
      <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.9rem; cursor: pointer;">
        <input type="checkbox" class="materia-checkbox" value="${m.id_materia}">
        <span>${m.nombre}</span>
      </label>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: red; font-size: 0.85rem;">Error: ${err.message}</p>`;
  }
};

// ==========================================
// GESTIÓN DINÁMICA DE TARIFA (MODO LECTURA / EDICIÓN)
// ==========================================
let perfilTutorCache = null;

window.renderSeccionTarifa = (tutor, modoEdicion = false) => {
  if (tutor) perfilTutorCache = tutor;
  const contenedor = document.getElementById('seccion-tarifa-container');
  if (!contenedor || !perfilTutorCache) return;

  const esRemunerado = String(perfilTutorCache.tipo_honorario || '').toLowerCase() === 'remunerado';

  if (!modoEdicion) {
    contenedor.innerHTML = `
      <div style="background: #eef4f8; padding: 1.2rem; border-radius: 6px; margin-bottom: 1.5rem; border: 1px solid #cce5ff; border-left: 4px solid ${esRemunerado ? '#28a745' : '#17a2b8'};">
        <h4 style="color: #004085; margin-top: 0; margin-bottom: 0.8rem;">Configuración de Tarifa Actual</h4>
        <p style="margin: 0.4rem 0;"><strong>Tipo de Honorario:</strong> ${perfilTutorCache.tipo_honorario || 'Voluntario'}</p>
        <p style="margin: 0.4rem 0;"><strong>Monto por Hora:</strong> ${esRemunerado ? `Gs. ${Number(perfilTutorCache.tarifa_hora || 0).toLocaleString('es-PY')}` : 'Gratuito (Voluntario)'}</p>
        <button type="button" class="btn btn-warning" style="margin-top: 0.8rem;" onclick="window.renderSeccionTarifa(null, true)">✏️ Modificar Tarifa</button>
      </div>
    `;
  } else {
    contenedor.innerHTML = `
      <form onsubmit="window.guardarCambioTarifa(event)" style="background: #fff; padding: 1.2rem; border-radius: 6px; margin-bottom: 1.5rem; border: 1px solid #cce5ff;">
        <h4 style="color: #004085; margin-top: 0; margin-bottom: 0.8rem;">Modificar Tarifa de Tutoría</h4>
        <div style="margin-bottom: 1rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Tipo de Honorario:</label>
          <select id="edit-tipo-honorario" class="btn" style="width:100%; border:1px solid #ccc; padding:0.5rem;" onchange="document.getElementById('edit-monto-box').style.display = (this.value === 'Remunerado' ? 'block' : 'none')">
            <option value="Voluntario" ${!esRemunerado ? 'selected' : ''}>Voluntario (Gratuito)</option>
            <option value="Remunerado" ${esRemunerado ? 'selected' : ''}>Remunerado</option>
          </select>
        </div>
        <div id="edit-monto-box" style="margin-bottom: 1rem; display: ${esRemunerado ? 'block' : 'none'};">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Monto por Hora (Gs.):</label>
          <input type="number" id="edit-tarifa-hora" step="1000" min="0" class="form-control" style="width:100%; padding:0.5rem; border:1px solid #ccc; border-radius:4px;" value="${perfilTutorCache.tarifa_hora || 0}">
        </div>
        <div style="display:flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.renderSeccionTarifa(null, false)">Cancelar</button>
          <button type="submit" class="btn btn-success" id="btn-save-tarifa">Guardar Cambios</button>
        </div>
      </form>
    `;
  }
};

window.guardarCambioTarifa = async (e) => {
  e.preventDefault();
  const tipo = document.getElementById('edit-tipo-honorario').value;
  const tarifa = (tipo === 'Remunerado') ? parseFloat(document.getElementById('edit-tarifa-hora').value || 0) : 0;
  const btn = document.getElementById('btn-save-tarifa');
  if (btn) toggleButtonLoading(btn, true);

  try {
    const actualizado = await tutorService.actualizarTarifa(tipo, tarifa);
    showToast('success', 'Tarifa modificada con éxito.');
    window.renderSeccionTarifa(actualizado, false);
  } catch (err) {
    showToast('error', err.message);
  } finally {
    if (btn) toggleButtonLoading(btn, false, 'Guardar Cambios');
  }
};

// ==========================================
// NUEVA VISTA: PANEL DE GESTIÓN DE TUTOR
// ==========================================
window.renderPanelTutor = async () => {
  app.innerHTML = `
    <div class="card" style="max-width: 650px; margin: auto;">
      <h3 style="color: #004085; margin-bottom: 1rem;">Panel de Tutor - Configuración</h3>
      
      <!-- CONTENEDOR DE SECCIÓN TARIFA -->
      <div id="seccion-tarifa-container">Cargando información de tarifa...</div>

      <!-- FORMULARIO DISPONIBILIDAD HORARIA -->
      <form id="form-disponibilidad" style="background: #f8f9fa; padding: 1.2rem; border-radius: 6px; border: 1px solid #e9ecef; margin-bottom: 1.5rem;">
        <h4 style="color: #004085; margin-bottom: 0.8rem;">Agregar Disponibilidad Semanal</h4>
        <div style="margin-bottom: 1rem;">
          <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Día de la semana:</label>
          <select id="disp-dia" class="btn" style="width: 100%; border: 1px solid #ccc; padding: 0.5rem;">
            <option value="Lunes">Lunes</option>
            <option value="Martes">Martes</option>
            <option value="Miércoles">Miércoles</option>
            <option value="Jueves">Jueves</option>
            <option value="Viernes">Viernes</option>
            <option value="Sábado">Sábado</option>
          </select>
        </div>
        <div style="display: flex; gap: 1rem; margin-bottom: 1.2rem;">
          <div style="flex: 1;">
            <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Hora Inicio:</label>
            <input type="time" id="disp-inicio" required style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div style="flex: 1;">
            <label style="display:block; margin-bottom: 0.3rem; font-weight: 500;">Hora Fin:</label>
            <input type="time" id="disp-fin" required style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.6rem;" id="btn-add-disp">
          Agregar Horario
        </button>
      </form>

      <h4 style="color: #004085; margin-bottom: 1rem;">Horarios Configurados</h4>
      <div id="lista-disponibilidades">Cargando disponibilidad...</div>
    </div>
  `;

  // CARGAR PERFIL DE TARIFA DEL TUTOR
  const cargarDatosTutor = async () => {
    try {
      let miPerfil = null;
      if (typeof tutorService.getMiPerfil === 'function') {
        miPerfil = await tutorService.getMiPerfil();
      } else {
        const tutores = await tutorService.getTutores('', '');
        miPerfil = tutores.find(t => 
          t.estudiante_id_estudiante === currentUser.id_estudiante || 
          (t.estudiante && t.estudiante.id_estudiante === currentUser.id_estudiante)
        );
      }
      if (miPerfil) {
        window.renderSeccionTarifa(miPerfil, false);
      } else {
        document.getElementById('seccion-tarifa-container').innerHTML = '';
      }
    } catch (e) {
      console.error("Error al cargar tarifa del tutor:", e);
    }
  };

  // CARGAR Y DIBUJAR LA TABLA DE HORARIOS
  const cargarDisponibilidades = async () => {
    const container = document.getElementById('lista-disponibilidades');
    try {
      const lista = await tutorService.getMiDisponibilidad();
      if (!lista || lista.length === 0) {
        container.innerHTML = '<p style="color: #666;">No tienes horarios cargados aún.</p>';
        return;
      }
      container.innerHTML = `
        <table class="table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #ddd; background: #f8f9fa;">
              <th style="padding: 0.6rem; text-align: left;">Día</th>
              <th style="padding: 0.6rem; text-align: left;">Hora Inicio</th>
              <th style="padding: 0.6rem; text-align: left;">Hora Fin</th>
              <th style="padding: 0.6rem; text-align: center;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${lista.map(d => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 0.6rem;"><strong>${d.dia_semana}</strong></td>
                <td style="padding: 0.6rem;">${d.hora_inicio}</td>
                <td style="padding: 0.6rem;">${d.hora_fin}</td>
                <td style="padding: 0.6rem; text-align: center;">
                  <button class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="window.eliminarHorario(${d.id})">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: red;">Error al cargar horarios: ${err.message}</p>`;
    }
  };

  // EVENTO AGREGAR DISPONIBILIDAD
  document.getElementById('form-disponibilidad').onsubmit = async (e) => {
    e.preventDefault();
    const dia = document.getElementById('disp-dia').value;
    const inicio = document.getElementById('disp-inicio').value;
    const fin = document.getElementById('disp-fin').value;

    if (fin <= inicio) {
      showToast('error', 'La hora fin debe ser posterior a la hora de inicio.');
      return;
    }

    const btn = document.getElementById('btn-add-disp');
    toggleButtonLoading(btn, true);

    try {
      await tutorService.agregarDisponibilidad(currentUser.id_estudiante, {
        dia_semana: dia,
        hora_inicio: inicio,
        hora_fin: fin
      });
      showToast('success', 'Horario agregado correctamente.');
      await cargarDisponibilidades();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      toggleButtonLoading(btn, false, 'Agregar Horario');
    }
  };

  // INICIALIZAR DATOS EN EL PANEL
  await cargarDatosTutor();
  await cargarDisponibilidades();
};

window.eliminarHorario = async (dispId) => {
  try {
    await tutorService.eliminarDisponibilidad(dispId);
    showToast('success', 'Horario eliminado.');
    if (window.renderPanelTutor) window.renderPanelTutor();
  } catch (err) {
    showToast('error', err.message);
  }
};

// ==========================================
// NUEVA VISTA: MIS TUTORÍAS (CITAS)
// ==========================================
// Modal interactivo con estrellas para calificar la tutoría
window.calificarTutoriaModal = (citaId) => {
  let puntuacionSeleccionada = 5;

  Swal.fire({
    title: 'Calificar Tutoría',
    html: `
      <p style="font-size: 0.9rem; color: #555; margin-bottom: 0.8rem;">Selecciona tu valoración sobre la sesión recibida:</p>
      <div id="star-rating-container" style="font-size: 2.2rem; color: #ffc107; cursor: pointer; margin-bottom: 1rem; text-align: center; user-select: none;">
        <span class="star" data-value="1">★</span>
        <span class="star" data-value="2">★</span>
        <span class="star" data-value="3">★</span>
        <span class="star" data-value="4">★</span>
        <span class="star" data-value="5">★</span>
      </div>
      <textarea id="swal-comentario" class="swal2-textarea" placeholder="Escribe un comentario opcional sobre el tutor..." style="width: 100%; margin: 0; font-size: 0.9rem; box-sizing: border-box;"></textarea>
    `,
    didOpen: () => {
      const stars = document.querySelectorAll('#star-rating-container .star');
      const updateStars = (val) => {
        puntuacionSeleccionada = val;
        stars.forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= val ? '#ffc107' : '#e4e5e9';
        });
      };
      stars.forEach(s => {
        s.onclick = () => updateStars(parseInt(s.dataset.value));
      });
      updateStars(5);
    },
    showCancelButton: true,
    confirmButtonText: 'Enviar Calificación',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const comentario = document.getElementById('swal-comentario').value;
      return { puntuacion: puntuacionSeleccionada, comentario };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await tutorService.calificarTutoria(citaId, result.value.puntuacion, result.value.comentario);
        showToast('success', '¡Gracias por calificar la tutoría!');
        window.renderMisCitas();
      } catch (err) {
        showToast('error', err.message);
      }
    }
  });
};

// Vista de Citas con integración del botón/Badge de Calificación
window.renderMisCitas = async () => {
  app.innerHTML = `
    <div class="card" style="max-width: 950px; margin: auto;">
      <h3 style="color: #004085; margin-bottom: 0.5rem;">Mis Tutorías y Citas Agendadas</h3>
      <p style="font-size: 0.9rem; color: #555; margin-bottom: 1.5rem;">
        Gestiona y consulta el estado de tus solicitudes de tutoría.
      </p>
      <div id="contenedor-citas">Cargando citas...</div>
    </div>
  `;

  const container = document.getElementById('contenedor-citas');

  try {
    const citas = await tutorService.getCitas();

    if (!citas || !citas.length) {
      container.innerHTML = '<p style="color: #666;">No posees citas ni solicitudes registradas actualmente.</p>';
      return;
    }

    const badgeStyles = {
      'Pendiente': 'background: #ffc107; color: #000;',
      'Aprobada': 'background: #28a745; color: #fff;',
      'Programada': 'background: #28a745; color: #fff;',
      'Rechazada': 'background: #dc3545; color: #fff;',
      'Cancelada': 'background: #6c757d; color: #fff;',
      'Finalizada': 'background: #17a2b8; color: #fff;',
      'Reprogramada': 'background: #fd7e14; color: #fff;'
    };

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #ddd; background: #f8f9fa;">
              <th style="padding: 0.75rem;">ID</th>
              <th style="padding: 0.75rem;">Materia / Tema</th>
              <th style="padding: 0.75rem;">Modalidad</th>
              <th style="padding: 0.75rem;">Ubicación / Enlace</th>
              <th style="padding: 0.75rem;">Fecha u Hora</th>
              <th style="padding: 0.75rem; text-align: center;">Estado</th>
              <th style="padding: 0.75rem; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${citas.map(c => {
              const estiloBadge = badgeStyles[c.estado] || 'background: #6c757d; color: #fff;';
              const fechaInicio = new Date(c.fecha_hora_inicio).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });

              // Evaluar si el usuario actual es el tutor asignado a la cita
              const esTutorDeLaCita = currentUser.es_tutor && (
                c.tutor_id_tutor === currentUser.id_estudiante ||
                (c.tutor && c.tutor.estudiante && c.tutor.estudiante.id_estudiante === currentUser.id_estudiante)
              );

              let botones = '';

              if (c.estado === 'Pendiente') {
                if (esTutorDeLaCita) {
                  botones += `<button class="btn btn-success" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.3rem;" onclick="window.actualizarEstadoCita(${c.id_cita}, 'Aprobada')">Aceptar</button>`;
                  botones += `<button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.actualizarEstadoCita(${c.id_cita}, 'Rechazada')">Rechazar</button>`;
                } else {
                  botones += `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.actualizarEstadoCita(${c.id_cita}, 'Cancelada')">Cancelar</button>`;
                }
              } else if (['Aprobada', 'Programada', 'Reprogramada'].includes(c.estado)) {
                if (esTutorDeLaCita) {
                  botones += `<button class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.3rem;" onclick="window.actualizarEstadoCita(${c.id_cita}, 'Finalizada')">Finalizar</button>`;
                }
                botones += `<button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.actualizarEstadoCita(${c.id_cita}, 'Cancelada')">Cancelar</button>`;
              } else if (['Finalizada', 'Realizada'].includes(c.estado)) {
                if (!esTutorDeLaCita) {
                  if (c.resena) {
                    const estrellas = '★'.repeat(c.resena.puntuacion);
                    botones = `<span style="color: #ffc107; font-weight: bold; font-size: 1.1rem;" title="${c.resena.comentario || 'Sin comentario'}">${estrellas}</span>`;
                  } else {
                    botones = `<button class="btn btn-warning" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.calificarTutoriaModal(${c.id_cita})">⭐ Calificar</button>`;
                  }
                } else {
                  if (c.resena) {
                    const estrellas = '★'.repeat(c.resena.puntuacion);
                    botones = `<span style="color: #ffc107; font-weight: bold; font-size: 1.1rem;" title="${c.resena.comentario || 'Sin comentario'}">${estrellas}</span>`;
                  } else {
                    botones = '<span style="color: #888; font-size: 0.85rem;">Sin calificar</span>';
                  }
                }
              } else {
                botones = '<span style="color: #888; font-size: 0.85rem;">-</span>';
              }

              return `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 0.75rem;">#${c.id_cita}</td>
                  <td style="padding: 0.75rem;"><strong>${c.materia_tema}</strong></td>
                  <td style="padding: 0.75rem;">${c.modalidad}</td>
                  <td style="padding: 0.75rem; font-size: 0.85rem;">${c.lugar_link}</td>
                  <td style="padding: 0.75rem; font-size: 0.85rem;">${fechaInicio}</td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span class="badge" style="${estiloBadge} padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">
                      ${c.estado}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; white-space: nowrap;">
                    ${botones}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: red;">Error al obtener citas: ${err.message}</p>`;
    showToast('error', err.message);
  }
};

// Función global para manejar la actualización de estados desde la UI
window.actualizarEstadoCita = async (citaId, nuevoEstado) => {
  if (!confirm(`¿Deseas cambiar el estado de la cita a "${nuevoEstado}"?`)) return;

  try {
    await tutorService.cambiarEstadoCita(citaId, nuevoEstado);
    showToast('success', `Cita actualizada a ${nuevoEstado}.`);
    window.renderMisCitas();
  } catch (err) {
    showToast('error', err.message);
  }
};

window.renderAuditoria = async () => {
  app.innerHTML = `
    <div class="card">
      <h3 style="color: #004085; margin-bottom: 1rem;">Registros de Auditoría del Sistema</h3>
      <div id="tabla-auditoria-container">Cargando registros...</div>
    </div>
  `;

  try {
    // Usar el nombre exacto declarado en tutorService:
    const logs = await tutorService.getAuditoriaLogs();
    
    const container = document.getElementById('tabla-auditoria-container');
    if (!logs || logs.length === 0) {
      container.innerHTML = '<p>No hay eventos registrados en auditoría.</p>';
      return;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem;">
        <thead>
          <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 8px;">ID Log</th>
            <th style="padding: 8px;">Fecha / Hora</th>
            <th style="padding: 8px;">ID Usuario</th>
            <th style="padding: 8px;">Acción</th>
            <th style="padding: 8px;">Detalles</th>
            <th style="padding: 8px;">IP Origen</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 8px;">#${log.id_log}</td>
              <td style="padding: 8px;">${new Date(log.fecha_hora).toLocaleString()}</td>
              <td style="padding: 8px;">${log.usuario_id || 'N/A'}</td>
              <td style="padding: 8px;"><strong>${log.accion}</strong></td>
              <td style="padding: 8px;">${log.detalles}</td>
              <td style="padding: 8px;"><code>${log.ip_origen}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    showToast('error', err.message);
  }
};
window.calificarTutoriaModal = (citaId) => {
  let puntuacionSeleccionada = 5;

  Swal.fire({
    title: 'Calificar Tutoría',
    html: `
      <p style="font-size: 0.9rem; color: #555; margin-bottom: 1rem;">Selecciona tu valoración sobre la sesión recibida:</p>
      <div id="star-rating-container" style="font-size: 2.2rem; color: #ffc107; cursor: pointer; margin-bottom: 1rem; text-align: center; user-select: none;">
        <span class="star" data-value="1">★</span>
        <span class="star" data-value="2">★</span>
        <span class="star" data-value="3">★</span>
        <span class="star" data-value="4">★</span>
        <span class="star" data-value="5">★</span>
      </div>
      <textarea id="swal-comentario" class="swal2-textarea" placeholder="Escribe un comentario opcional sobre el tutor..." style="width: 100%; margin: 0; font-size: 0.9rem;"></textarea>
    `,
    didOpen: () => {
      const stars = document.querySelectorAll('#star-rating-container .star');
      const updateStars = (val) => {
        puntuacionSeleccionada = val;
        stars.forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= val ? '#ffc107' : '#e4e5e9';
        });
      };
      stars.forEach(s => {
        s.onclick = () => updateStars(parseInt(s.dataset.value));
      });
      updateStars(5);
    },
    showCancelButton: true,
    confirmButtonText: 'Enviar Calificación',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const comentario = document.getElementById('swal-comentario').value;
      return { puntuacion: puntuacionSeleccionada, comentario };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await tutorService.calificarTutoria(citaId, result.value.puntuacion, result.value.comentario);
        showToast('success', '¡Gracias por calificar la tutoría!');
        window.renderMisCitas();
      } catch (err) {
        showToast('error', err.message);
      }
    }
  });
};
// ==========================================
// INICIALIZACIÓN Y CONTROL DE RUTAS HASH (AL FINAL DEL ARCHIVO)
// ==========================================
function checkUrlRoute() {
  const hash = window.location.hash;
  if (hash.includes('/reset-password')) {
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);
    const token = urlParams.get('token');
    
    if (token) {
      renderResetPasswordView(token);
      return true;
    }
  }
  return false;
}

window.addEventListener('hashchange', () => {
  if (!checkUrlRoute()) {
    renderNav();
    if (currentUser) {
      window.renderCatalog();
    } else {
      renderLogin();
    }
  }
});

if (!checkUrlRoute()) {
  renderNav();
  if (currentUser) {
    window.renderCatalog();
  } else {
    renderLogin();
  }
}