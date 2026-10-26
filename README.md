# Mi galería

Galería web para **subir, guardar y ver imágenes**. Funciona por completo en local
## Funcionalidades

- Subida de imágenes JPG, PNG, WebP y GIF (máx. 10 MB, configurable), con barra de progreso.
- Miniatura WebP de 400 px generada en el navegador antes de subir.
- Galería en cuadrícula responsive, con carga diferida y paginación ("Cargar más").
- Vista ampliada (lightbox): ← / → para navegar, Esc para cerrar.
- Página de detalle con dimensiones, tamaño, tipo y fecha, y botón de eliminar con confirmación.
- Modo claro y oscuro (sigue al sistema y recuerda la elección).
- Validación en el servidor: tipo MIME, extensión, contenido real del archivo y tamaño.

## Stack

| Capa       | Tecnología                                       |
| ---------- | ------------------------------------------------ |
| Framework  | Astro 7 (`output: 'server'`) + TypeScript strict |
| Runtime    | `@astrojs/cloudflare` sobre workerd, en local    |
| Estilos    | Tailwind CSS 4                                   |
| Imágenes   | R2 emulado en local (Miniflare)                  |
| Metadatos  | D1 / SQLite emulado en local + Drizzle ORM       |
| Validación | Zod                                              |
| Calidad    | ESLint, Prettier, Vitest                         |

Los datos se guardan en `.wrangler/state/`. **Borrar esa carpeta elimina todas las imágenes.**

## Requisitos

- Node.js 22.12 o superior (recomendado 24 LTS).

## Puesta en marcha

```sh
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply DB --local
npm run dev
```

Abrir <http://localhost:4321>.

## Comandos

| Comando                    | Acción                                    |
| -------------------------- | ----------------------------------------- |
| `npm run dev`              | Servidor de desarrollo                    |
| `npm run build`            | Build de producción                       |
| `npm run preview`          | Probar el build en local                  |
| `npm run lint`             | ESLint                                    |
| `npm run format`           | Prettier                                  |
| `npm run check`            | Comprobación de tipos                     |
| `npm test`                 | Tests con Vitest                          |
| `npm run generate-types`   | Regenerar tipos de bindings de Wrangler   |
| `npx drizzle-kit generate` | Generar migración tras cambiar el esquema |

## API

| Método | Ruta              | Descripción                                 |
| ------ | ----------------- | ------------------------------------------- |
| POST   | `/api/images`     | Sube original y miniatura (multipart)       |
| GET    | `/api/images`     | Lista paginada (`?cursor=&limit=`)          |
| GET    | `/api/images/:id` | Detalle de una imagen                       |
| DELETE | `/api/images/:id` | Borra la imagen y su miniatura              |
| GET    | `/files/{clave}`  | Sirve el archivo (`originals/` o `thumbs/`) |
