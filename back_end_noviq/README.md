# NOVIQ E-commerce Backend

Flask API with MySQL persistence for customer accounts, products, inventory,
and orders.

## Features

- Customer registration and login with session-cookie authentication
- Seller-only product and inventory management
- Order placement with stock checks and restocking when an order is cancelled
- Cash on delivery (COD); no payment gateway is connected yet
- Single-store model: one seller account manages the full catalog, inventory,
  and all customer orders

## Install dependencies

From this directory, create and activate a virtual environment, then install
the pinned backend packages:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Apply database migrations

From this directory, set the connection string and a strong local secret, then
apply the checked-in migrations:

```powershell
$env:DB_USER = "your-username"
$env:DB_PASSWORD = "your-password"
$env:DB_HOST = "127.0.0.1"
$env:DATABASE_URL = "mysql+pymysql://" + $env:DB_USER + ":" + $env:DB_PASSWORD + "@" + $env:DB_HOST + ":3306/noviq_db"
$env:SECRET_KEY = "set-a-long-random-secret"
flask --app run db upgrade
```

The `migrations` directory is already initialized. Do not run `db init` again.
Review each migration and confirm the target database before upgrading,
especially in production. The inventory/auth/order migration adds
`products.stock` and the order tables; apply it before using checkout or the
Seller Center.
The `20261103_repair_tables` migration repairs a database that was marked at
`20261102_orders` while its business tables were missing. It creates
`categories`, `users`, `products`, `orders`, and `order_items`, and aborts
without changing the database if any of those tables already exists.

## Create a seller

After upgrading the database, create a seller interactively:

```powershell
flask --app run create-seller
```

The command prompts for email, seller name, and password. Public registration
creates customer accounts only. The command refuses to create another seller
account while a seller account already exists; use the existing seller account
to manage the entire store.

The backend also rejects seller-only requests unless exactly one active seller
account exists. If earlier testing created multiple seller accounts, demote or
deactivate the extras before using Seller Center.

## Run locally

Start the API from this directory:

```powershell
python run.py
```

It listens on `127.0.0.1:5000`. In another terminal, run `npm run dev` from
`front_end_noviq`; the Vite development proxy forwards `/api` requests to Flask.

## Deployment configuration

Configure `DATABASE_URL`, a strong `SECRET_KEY`, and `CORS_ORIGINS` for the
deployed services. When the frontend and API are cross-site, serve both over
HTTPS and set `SESSION_COOKIE_SAMESITE=None` and
`SESSION_COOKIE_SECURE=true`. Do not deploy with the local fallback secret.
Set the frontend build variable `VITE_API_BASE_URL` to the deployed API origin;
leave it empty for local development, where Vite proxies `/api` to Flask.
For Cloud SQL, run migrations as an explicit release step against the intended
database; the application does not migrate the schema automatically.

## Build the Cloud Run container

The Dockerfile installs Gunicorn and runs the Flask application on the `PORT`
provided by Cloud Run. Build the image from this directory so the migrations
and application packages are included:

```powershell
docker build -t noviq-backend .
docker run --rm -p 8080:8080 `
  -e PORT=8080 `
  -e SECRET_KEY="use-a-strong-secret" `
  -e DATABASE_URL="your-mysql-connection-url" `
  -e CORS_ORIGINS="https://your-frontend.example" `
  noviq-backend
```

Do not pass production secrets on a shared command line or bake them into the
image. Configure them as Cloud Run environment variables backed by Secret
Manager, and configure the Cloud SQL connection separately. The container
does not run database migrations at startup; apply reviewed migrations as an
explicit release step before routing production traffic.

## Deploy with Cloud Build

`cloudbuild.yaml` builds and pushes the backend image to Artifact Registry,
then deploys that image to Cloud Run. Create the Artifact Registry Docker
repository, Cloud SQL instance, Secret Manager secrets, and runtime service
account before connecting a Cloud Build trigger to this file.

Update the substitutions at the top of `cloudbuild.yaml` for the deployment:

- `_REGION`, `_AR_REPOSITORY`, `_IMAGE`, and `_SERVICE` identify the region,
  Artifact Registry repository, image, and Cloud Run service.
- `_CLOUDSQL_INSTANCE` must be the full `PROJECT_ID:REGION:INSTANCE_ID`.
- Store the complete MySQL SQLAlchemy URL in `_DATABASE_URL_SECRET` and a
  strong random application key in `_SECRET_KEY_SECRET`. The database URL
  should use the Cloud SQL Unix socket path `/cloudsql/PROJECT_ID:REGION:INSTANCE_ID`.
- `_RUNTIME_SERVICE_ACCOUNT` is the identity used by the Cloud Run revision.
- `_CORS_ORIGINS` is the exact frontend origin, such as
  `https://noviq.example`; list multiple origins separated by commas.

Grant the Cloud Build service account permission to push to the repository,
deploy Cloud Run services, and act as the runtime service account. Grant the
runtime service account Secret Manager Secret Accessor on the two secrets and
Cloud SQL Client on the project. Connect the GitHub repository to a Cloud Build
trigger that uses `back_end_noviq/cloudbuild.yaml`.

The trigger deploys whenever it runs. Configure its branch filter and decide
whether it should deploy staging or production before enabling automatic
deployments. The build does not run migrations; back up the target database
and apply reviewed migrations as a separate release step.
