import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")  # Tu correo Gmail / Institucional
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # App Password de Gmail
FROM_EMAIL = os.getenv("FROM_EMAIL", "tutorconnect@fp-unves.edu.py")

def enviar_correo(to_email: str, subject: str, html_content: str):
    # Modo Simulación Local si no hay contraseña SMTP configurada
    if not SMTP_USER or not SMTP_PASSWORD:
        print("\n================ [ENVÍO DE CORREO SIMULADO] ================")
        print(f"Para: {to_email}")
        print(f"Asunto: {subject}")
        print(f"Contenido HTML:\n{html_content}")
        print("============================================================\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"[SMTP Error] Fallo al enviar correo a {to_email}: {e}")


def notificar_tutor_nueva_cita(email_tutor: str, nombre_tutor: str, nombre_estudiante: str, materia: str, fecha_inicio: str):
    """Construye la plantilla y envía la notificación de tutoría pendiente al tutor."""
    asunto = f"🎓 TutorConnect - Nueva solicitud de tutoría: {materia}"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
          <h2 style="color: #004085;">¡Hola, {nombre_tutor}!</h2>
          <p>El estudiante <strong>{nombre_estudiante}</strong> ha solicitado una sesión de tutoría contigo en TutorConnect.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8f9fa;">
            <tr>
              <td style="padding: 10px; font-weight: bold;">Materia / Tema:</td>
              <td style="padding: 10px;">{materia}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Fecha u Hora:</td>
              <td style="padding: 10px;">{fecha_inicio}</td>
            </tr>
          </table>

          <p>Por favor, ingresa a la plataforma <strong>TutorConnect (FP-UNVES)</strong> para Aceptar o Rechazar la solicitud.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <small style="color: #777;">Este es un mensaje automático generado por TutorConnect.</small>
        </div>
      </body>
    </html>
    """
    
    enviar_correo(to_email=email_tutor, subject=asunto, html_content=html_content)