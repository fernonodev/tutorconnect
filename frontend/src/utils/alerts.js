import Swal from 'sweetalert2';

export const showToast = (icon, title) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
  Toast.fire({ icon, title });
};

export const showConfirmModal = async (title, text, confirmButtonText = 'Sí, continuar') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#004085',
    cancelButtonColor: '#d33',
    confirmButtonText,
    cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
};

export const toggleButtonLoading = (buttonElement, isLoading, defaultText = 'Guardar') => {
  if (!buttonElement) return;
  if (isLoading) {
    buttonElement.disabled = true;
    buttonElement.dataset.originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = `<span class="spinner"></span> Procesando...`;
  } else {
    buttonElement.disabled = false;
    buttonElement.innerHTML = buttonElement.dataset.originalText || defaultText;
  }
};

export const validarRangoHoras = (horaInicio, horaFin) => {
  if (!horaInicio || !horaFin) return false;
  return horaFin > horaInicio;
};
