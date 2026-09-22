param(
  [string]$StoreSlug = "bodega-jl",
  [string]$StoreName = "Bodega JL",
  [string]$CatalogUrl = ""
)

$ErrorActionPreference = "Stop"

$workspace = "C:\Users\DerEine\Desktop\app bodega"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME = "C:\Users\DerEine\AppData\Local\Android\Sdk"

# Normalizar slug y url
$cleanSlug = ($StoreSlug.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($CatalogUrl)) {
  $CatalogUrl = "https://$cleanSlug.onrender.com"
}
$appPackageId = "com.bogad." + ($cleanSlug -replace '[^a-z0-9]', '')

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "COMPILANDO APK MULTI-TIENDA BOGAD..." -ForegroundColor Yellow
Write-Host "Tienda: $StoreName ($cleanSlug)" -ForegroundColor Yellow
Write-Host "Catálogo Web: $CatalogUrl" -ForegroundColor Yellow
Write-Host "Package ID: $appPackageId" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location $workspace

# 1. Configurar variables de entorno específicas para esta tienda durante el build
$envLocalContent = @"
VITE_STORE_SLUG=$cleanSlug
VITE_BODEGA_NAME=$StoreName
VITE_CATALOG_URL=$CatalogUrl
"@
Set-Content -Path "$workspace\.env.local" -Value $envLocalContent -Encoding UTF8

try {
  # 2. Compilar frontend Vite con la configuración de la tienda
  & npx vite build

  # 3. Configurar Capacitor
  $unifiedCapConfig = @"
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '$appPackageId',
  appName: '$StoreName',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
"@
  Set-Content -Path "$workspace\capacitor.config.ts" -Value $unifiedCapConfig -Encoding UTF8

  # 4. Sincronizar proyecto Android
  & npx cap sync android

  # 5. Desactivar Service Worker agresivo dentro del WebView nativo
  $killSw = @"
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.registration.unregister();
    })
  );
});
"@
  if (Test-Path "$workspace\android\app\src\main\assets\public\sw.js") {
    Set-Content -Path "$workspace\android\app\src\main\assets\public\sw.js" -Value $killSw -Encoding UTF8
  }

  # 6. Actualizar build.gradle y strings.xml con el nombre e ID de la tienda
  (Get-Content "$workspace\android\app\build.gradle") -replace 'applicationId ".*"', "applicationId `"$appPackageId`"" | Set-Content "$workspace\android\app\build.gradle"
  (Get-Content "$workspace\android\app\src\main\res\values\strings.xml") -replace '<string name="app_name">.*</string>', "<string name=`"app_name`">$StoreName</string>" | Set-Content "$workspace\android\app\src\main\res\values\strings.xml"

  # 7. Compilar APK con Gradle
  Set-Location "$workspace\android"
  & .\gradlew.bat assembleDebug

  # 8. Copiar APKs generadas con nombres limpios
  $cleanFileName = ($StoreName -replace '[^a-zA-Z0-9]', '-') -replace '-+', '-'
  Copy-Item "$workspace\android\app\build\outputs\apk\debug\app-debug.apk" "$workspace\Bogad.apk" -Force
  Copy-Item "$workspace\android\app\build\outputs\apk\debug\app-debug.apk" "$workspace\$cleanFileName.apk" -Force
  Copy-Item "$workspace\android\app\build\outputs\apk\debug\app-debug.apk" "$workspace\Bogad-Dueño.apk" -Force
  Copy-Item "$workspace\android\app\build\outputs\apk\debug\app-debug.apk" "$workspace\Bogad-Dueno.apk" -Force
  Copy-Item "$workspace\android\app\build\outputs\apk\debug\app-debug.apk" "$workspace\Bogad-Cliente.apk" -Force

  Write-Host "==========================================" -ForegroundColor Green
  Write-Host "¡APK MULTI-TIENDA GENERADA EXITOSAMENTE!" -ForegroundColor Green
  Write-Host "APK Principal: $workspace\Bogad.apk" -ForegroundColor Green
  Write-Host "APK Específica: $workspace\$cleanFileName.apk" -ForegroundColor Green
  Write-Host "==========================================" -ForegroundColor Green
}
finally {
  # Limpiar .env.local temporal para no ensuciar el workspace
  if (Test-Path "$workspace\.env.local") {
    Remove-Item "$workspace\.env.local" -Force
  }
}
