# Email Testing Endpoints

Este módulo proporciona endpoints para probar todos los templates de email con diferentes temas.

## Endpoints Disponibles

### Base URL
```
GET /email-test
```

### 1. Probar Template de Verification Code
```
GET /email-test/verification-code?theme=medvirtual&berry=false&email=test@example.com
```

**Parámetros:**
- `theme` (opcional): `medvirtual` o `berry` (default: `medvirtual`)
- `berry` (opcional): `true` o `false` (default: `false`)
- `email` (opcional): Email de destino (default: `test@example.com`)

**Ejemplo:**
```bash
# MedVirtual theme
curl "http://localhost:3000/email-test/verification-code?theme=medvirtual&berry=false&email=test@example.com"

# Berry Virtual theme
curl "http://localhost:3000/email-test/verification-code?theme=berry&berry=true&email=test@example.com"
```

### 2. Probar Template de Invite Signup
```
GET /email-test/invite-signup?theme=medvirtual&email=test@example.com
```

**Parámetros:**
- `theme` (opcional): `medvirtual` o `berry` (default: `medvirtual`)
- `email` (opcional): Email de destino (default: `test@example.com`)

**Ejemplo:**
```bash
curl "http://localhost:3000/email-test/invite-signup?theme=berry&email=test@example.com"
```

### 3. Probar Template de Reset Password
```
GET /email-test/reset-password?theme=medvirtual&email=test@example.com
```

**Parámetros:**
- `theme` (opcional): `medvirtual` o `berry` (default: `medvirtual`)
- `email` (opcional): Email de destino (default: `test@example.com`)

**Ejemplo:**
```bash
curl "http://localhost:3000/email-test/reset-password?theme=medvirtual&email=test@example.com"
```

### 4. Probar Template de Notification
```
GET /email-test/notification?theme=medvirtual&email=test@example.com
```

**Parámetros:**
- `theme` (opcional): `medvirtual` o `berry` (default: `medvirtual`)
- `email` (opcional): Email de destino (default: `test@example.com`)

**Ejemplo:**
```bash
curl "http://localhost:3000/email-test/notification?theme=berry&email=test@example.com"
```

### 5. Probar Todos los Templates
```
GET /email-test/all?theme=medvirtual&email=test@example.com
```

**Parámetros:**
- `theme` (opcional): `medvirtual` o `berry` (default: `medvirtual`)
- `email` (opcional): Email de destino (default: `test@example.com`)

**Ejemplo:**
```bash
curl "http://localhost:3000/email-test/all?theme=berry&email=test@example.com"
```

## Temas Disponibles

### MedVirtual (Default)
- **Color primario**: #01546B
- **Color hover**: #013A4F
- **Nombre**: MedVirtual
- **Uso**: Para usuarios sin organización o con organización que no sea Berry Virtual

### Berry Virtual
- **Color primario**: #FD7171
- **Color hover**: #E55A5A
- **Nombre**: Berry Virtual
- **Uso**: Para usuarios con organización Berry Virtual activa

## Respuesta de la API

### Respuesta Exitosa
```json
{
  "success": true,
  "message": "Email sent successfully",
  "theme": "MedVirtual",
  "isBerryVirtual": false,
  "verificationCode": "123456",
  "verificationUrl": "http://localhost:3000/signup/verification-code?t=123456&berry=false"
}
```

### Respuesta de Error
```json
{
  "success": false,
  "message": "Failed to send email",
  "error": "Error details here"
}
```

### Respuesta para /all
```json
{
  "success": true,
  "message": "All email templates sent successfully",
  "theme": "MedVirtual",
  "results": {
    "verificationCode": { "success": true, "message": "..." },
    "inviteSignup": { "success": true, "message": "..." },
    "resetPassword": { "success": true, "message": "..." },
    "notification": { "success": true, "message": "..." }
  }
}
```

## Características de los Templates

### Diseño Moderno
- Logo con punto de color
- Saludo simple "Hi,"
- Mensaje principal con emoji :)
- Botón CTA moderno
- Cierre personalizado "Best, [Company] team"
- Footer minimalista con soporte

### Responsive
- Compatible con clientes de email
- Fuentes del sistema
- Estilos inline para máxima compatibilidad

### Temática Dinámica
- Colores según la organización
- Nombre de empresa dinámico
- Email de soporte personalizado

## Uso en Desarrollo

1. **Iniciar el servidor**:
   ```bash
   npm run start:dev
   ```

2. **Probar un template específico**:
   ```bash
   curl "http://localhost:3000/email-test/verification-code?theme=berry&email=tu-email@ejemplo.com"
   ```

3. **Probar todos los templates**:
   ```bash
   curl "http://localhost:3000/email-test/all?theme=medvirtual&email=tu-email@ejemplo.com"
   ```

## Variables de Entorno Requeridas

Asegúrate de tener configuradas las siguientes variables de entorno:

```bash
# Requerido para el servicio de mail
RESEND_API_KEY=tu_api_key_de_resend

# Opcional - Email de remitente (default: noreply@medvirtual.ai)
FROM_EMAIL=noreply@medvirtual.ai

# Opcional - URL del frontend (default: http://localhost:3000)
FRONTEND_URL=http://localhost:3000
```

## Archivos de Logo Requeridos

Asegúrate de tener los siguientes archivos de logo en tu frontend:

```
frontend/public/logo.png      # Logo de MedVirtual
frontend/public/logobv.png    # Logo de Berry Virtual
```

Los templates seleccionarán automáticamente el logo correcto según el tema:
- **MedVirtual**: `logo.png`
- **Berry Virtual**: `logobv.png`

## Notas Importantes

- Los emails se envían realmente usando el servicio de mail configurado
- Los tokens y códigos son de prueba (no válidos para uso real)
- Asegúrate de tener configurado correctamente el servicio de mail (Resend)
- Los endpoints están disponibles solo en desarrollo (considera agregar guards para producción)
- El campo `from` se toma de `FROM_EMAIL` o usa `noreply@medvirtual.ai` por defecto
