# NOVIQ E-commerce Backend

Flask API with MySQL persistence for customer accounts, products, inventory,
and orders.

## Features

- Customer registration and login with session-cookie authentication
- Seller-only product and inventory management
- Customer product reviews stored in the database and shared across visitors
- Order placement with stock checks and restocking when an order is cancelled
- Cash on delivery (COD); no payment gateway is connected yet
- Multi-store model: each seller owns a separate catalog, inventory, and
  seller-specific orders
- Mixed-store checkouts are split into one order per store and linked by a
  checkout ID

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
`categories`, `users`, `products`, `orders`, and `order_items` only when none
of those tables exist; it leaves a complete schema alone and aborts if only
some are present.
The `20261113_product_images` migration adds the ordered `product_images`
gallery and copies each existing `products.image_url` into it as the cover
image. The original `image_url` column remains the cover image for existing
API consumers. Product create/update requests may send up to 10 public image
absolute HTTP or HTTPS URLs in `image_urls`; the existing single `image_url`
field remains supported.
The `20261114_multi_store` migration adds stores, assigns legacy products and
orders to the existing seller's store, and adds a shared checkout ID for
seller-specific orders. If legacy products or orders exist without exactly one
seller account, the migration stops before changing the schema rather than
guessing their ownership.
The `20261115_category_hierarchy` migration adds a nullable parent category,
keeps existing categories as root nodes, and seeds a starter marketplace tree
including Điện tử > Máy tính > Laptop > Gaming/Văn phòng/Đồ họa. Product
create/update requests should send `category_id`; the legacy `category` name is
accepted only when it matches exactly one active category. `GET
/api/products/categories` returns the full category tree, and catalog requests
may pass `category_id` to include products assigned anywhere below that node.
The `20261116_product_reviews` migration adds persistent product reviews.
`GET /api/products/<product_id>/reviews` returns the public review feed and its
rating summary. `POST` to the same endpoint requires an active customer session
and a valid CSRF token; the reviewer name is taken from the customer account,
and ratings/comments are validated by the API. The Cloud Build migration job
applies this migration before deploying the backend revision.

## Product image uploads

Seller product forms can upload JPEG, PNG, and WebP files. The backend checks
and re-encodes each image before uploading it to Cloud Storage; product records
continue to store image URLs. Uploads are limited to 10 images per product,
5 MB per file, 25 MB total, and 25 megapixels per image. The Cloud Storage
bucket must be configured before file uploads are enabled.

Create a dedicated bucket in the same region as the backend, then grant the
Cloud Run runtime service account `roles/storage.objectUser` on that bucket.
This role lets the backend upload images and remove objects from a failed
product save. Keep unrelated or private files out of this bucket.

```powershell
gcloud storage buckets create gs://YOUR_UNIQUE_BUCKET `
  --location=asia-southeast1 `
  --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://YOUR_UNIQUE_BUCKET `
  --member="serviceAccount:YOUR_RUNTIME_SERVICE_ACCOUNT" `
  --role="roles/storage.objectUser"
```

Product images are public assets. To use the default
`https://storage.googleapis.com/<bucket>/<object>` URLs, grant
`roles/storage.objectViewer` to `allUsers` on this dedicated bucket if your
organization permits public buckets. Otherwise, serve the bucket through an
appropriately configured CDN and set `PRODUCT_IMAGES_PUBLIC_BASE_URL` to its
public base URL. The application does not change bucket IAM or make objects
public.

Set `PRODUCT_IMAGES_BUCKET` in the backend environment. The Cloud Build
substitution `_PRODUCT_IMAGES_BUCKET` provides this value for Cloud Run; update
the sample bucket name in `cloudbuild.yaml` to the bucket you created. For
local uploads, use Application Default Credentials (for example,
`gcloud auth application-default login`) and set the bucket name in the local
environment. Do not put a service-account key in the repository or container.
Without a configured bucket, URL-based product images continue to work, while
file uploads return a clear service-unavailable error.

## Create the website admin

After applying migrations, create an admin account from the backend directory:

```powershell
flask --app run create-admin
```

The command prompts for name, email, and a password of at least 12 characters.
Admin accounts cannot be created through public registration. Open
`https://<backend-cloud-run-url>/admin` to sign in. The admin dashboard shows
six-month revenue and completed-order charts, with dedicated marketplace pages
at `/admin/stores` and `/admin/products` and the category tree at
`/admin/categories`. The marketplace pages support search, status filters, and
pagination; sales totals include completed orders only. The
customer-account page at `/admin/customers` has the same search and filtering
tools. Admins can disable or re-enable customer accounts; disabled customers
cannot sign in, and their order history is preserved. Admins can also create
seller accounts and their stores from the dashboard.

Run the bootstrap command only against the intended database. For production,
use a one-time operator-run Cloud Run Job attached to Cloud SQL and inject
`ADMIN_BOOTSTRAP_PASSWORD` from a temporary Secret Manager secret; do not put
the password in the job arguments, source code, or build logs. Remove the
temporary secret and job after provisioning.

## Create a seller

After upgrading the database, create a seller interactively:

```powershell
flask --app run create-seller
```

The command prompts for email, seller name, store name, and password. Run it
only as an administrator with access to the production database. Each seller
account owns one independent store; an existing customer account can be
promoted when it does not already own a store. Public registration continues
to create customer accounts only.

Seller API requests are scoped to the signed-in seller's active store. Product
ownership is assigned by the backend and cannot be selected by the browser.
When a customer's cart contains products from multiple stores, checkout creates
one independently managed order per store. The create-order response contains
the shared `checkout_id` and an `orders` array; customer order history lists
each store order separately.

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
database; the application does not migrate the schema automatically. The
Cloud Build deployment pipeline runs pending migrations using a Cloud Run Job
before deploying the backend service.

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
updates and executes a Cloud Run Job to apply pending database migrations, and
then deploys that image to the Cloud Run service. Create the Artifact Registry
Docker repository, Cloud SQL instance and database, Secret Manager secrets,
and runtime service account before connecting a Cloud Build trigger to this
file.

Update the substitutions at the top of `cloudbuild.yaml` for the deployment:

- `_REGION`, `_AR_REPOSITORY`, `_IMAGE`, `_SERVICE`, and `_MIGRATION_JOB`
  identify the region, Artifact Registry repository, image, Cloud Run service,
  and migration job.
- `_CLOUDSQL_INSTANCE` must be the full `PROJECT_ID:REGION:INSTANCE_ID`.
- Store the complete MySQL SQLAlchemy URL in `_DATABASE_URL_SECRET` and a
  strong random application key in `_SECRET_KEY_SECRET`. The database URL
  should use the Cloud SQL Unix socket path `/cloudsql/PROJECT_ID:REGION:INSTANCE_ID`.
- `_RUNTIME_SERVICE_ACCOUNT` is the identity used by the Cloud Run revision.
- `_PRODUCT_IMAGES_BUCKET` is the dedicated Cloud Storage bucket for public
  product images. The runtime service account needs `roles/storage.objectUser`
  on this bucket.
- `_CORS_ORIGINS` is the exact frontend origin, such as
  `https://noviq.example`; list multiple origins separated by commas.

Grant the Cloud Build service account permission to push to the repository,
deploy Cloud Run services and jobs, execute Cloud Run jobs, and act as the
runtime service account. Grant the runtime service account Secret Manager
Secret Accessor on the database URL secret and Cloud SQL Client on the project.
The backend service also needs Secret Manager Secret Accessor on the application
key secret. Connect the GitHub repository to a Cloud Build trigger that uses
`back_end_noviq/cloudbuild.yaml`.

The trigger deploys whenever it runs. Configure its branch filter and decide
whether it should deploy staging or production before enabling automatic
deployments. Each run executes `flask --app run db upgrade` before deploying
the service; Alembic applies only migrations not yet recorded in the database.
Review schema changes and back up production data before deployment. For
zero-downtime releases, keep migrations backward-compatible with both the
currently serving and newly deployed application revisions.

The first multi-store migration makes store ownership required on products
and orders, so a previously deployed single-store revision cannot continue
writing during the migration-to-deploy gap. If this is already serving live
traffic, perform the first rollout during a maintenance window or split it
into backward-compatible releases.
