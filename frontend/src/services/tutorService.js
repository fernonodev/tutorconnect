const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Función auxiliar para adjuntar automáticamente el Token JWT a las peticiones autenticadas
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const tutorService = {
  // --- Autenticación y Registro ---

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión.');
    return data;
  },

  async register(payload) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al completar el registro.');
    return data;
  },

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al solicitar la recuperación de contraseña.');
    return data;
  },

  async resetPassword(token, new_password) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al restablecer la contraseña.');
    return data;
  },

  // --- Módulo de Tutores, Postulación OCR y Disponibilidad ---

  async getTutores(carreraId = '', query = '') {
    const params = new URLSearchParams();
    if (carreraId) params.append('carrera_id', carreraId);
    if (query) params.append('q', query);

    const res = await fetch(`${API_BASE}/tutores?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al cargar el catálogo de tutores.');
    return data;
  },
  async actualizarTarifa(tipoHonorario, tarifaHora) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/tutores/perfil/tarifa`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        tipo_honorario: tipoHonorario,
        tarifa_hora: parseFloat(tarifaHora || 0)
      })
    });
  
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al actualizar la tarifa.');
    return data;
  },
  async solicitarSerTutor(formData) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/tutores/postular`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        // No se especifica 'Content-Type' para permitir boundary de multipart/form-data
      },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al procesar la postulación de tutor.');
    return data;
  },

  async agregarDisponibilidad(tutorId, data) {
    const res = await fetch(`${API_BASE}/tutores/${tutorId}/disponibilidad`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.detail || 'Error al agregar el horario de disponibilidad.');
    return resData;
  },

  // --- Módulo de Citas y Tutorías ---

  async crearCita(citaData) {
    const res = await fetch(`${API_BASE}/citas/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(citaData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar la solicitud de cita.');
    return data;
  },

  async getMisCitas() {
    const res = await fetch(`${API_BASE}/citas/mis-citas`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al consultar tus tutorías.');
    return data;
  },

  // Alias para mantener compatibilidad con las llamadas de main.js
  async getCitas() {
    return this.getMisCitas();
  },

  // --- Módulo de Auditoría (Exclusivo Administrador) ---
// Obtener disponibilidad del tutor autenticado
async getMiDisponibilidad() {
  const res = await fetch(`${API_BASE}/tutores/perfil/disponibilidad`, {
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al obtener la disponibilidad.');
  return data;
},

// Eliminar un bloque de disponibilidad por su ID
async eliminarDisponibilidad(dispId) {
  const res = await fetch(`${API_BASE}/tutores/disponibilidad/${dispId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Error al eliminar el horario.');
  }
  return true;
},
// Cambiar estado de una cita (Aprobada, Rechazada, Cancelada, Finalizada, Reprogramada)
async cambiarEstadoCita(citaId, nuevoEstado) {
  const res = await fetch(`${API_BASE}/citas/${citaId}/estado`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ nuevo_estado: nuevoEstado })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar el estado de la cita.');
  return data;
},
async calificarTutoria(citaId, puntuacion, comentario) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/citas/${citaId}/resena`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ puntuacion, comentario })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al enviar la calificación.');
  return data;
},
// Añadir en tutorService.js

async getAuditoriaLogs() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/auditoria`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar registros de auditoría.');
  return data;
},
  async getMateriasPorCarrera(carreraId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/carreras/${carreraId}/materias`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al obtener materias.');
    return data;
  }
  
};