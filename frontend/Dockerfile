# ==========================================
# Етап 1: Збірка (Build Stage)
# ==========================================
FROM node:20-alpine as build

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо файли з залежностями
COPY package*.json ./

# Встановлюємо пакети
RUN npm install

# Копіюємо весь код проекту
COPY . .

# Збираємо проект (Vite створить папку dist)
RUN npm run build

# ==========================================
# Етап 2: Продакшен сервер (Production Stage)
# ==========================================
FROM nginx:alpine

# Копіюємо зібрані файли з першого етапу в папку, яку роздає Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копіюємо наш конфіг Nginx (щоб працював React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Відкриваємо 80 порт
EXPOSE 80

# Запускаємо Nginx
CMD ["nginx", "-g", "daemon off;"]
