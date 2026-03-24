# Database Setup

## MySQL Docker setup

Files added:

- `docker-compose.yml` - Compose service for MySQL
- `.env.exampel` - Environment variables (credentials)

How to run it:
- make sure nothing else is running on port 3306; if there is, either stop the local MySQL service (`systemctl stop`) or the Docker container occupying the port, or change the port to `3307` in the docker compose file
- make sure the Docker service is running (`systemctl status docker` to check, `systemctl start docker` to start it)
- create a file called `.env` in the `backend` directory and copy the contents of `.env.example` in it
- run the container using `docker compose up -d`
- you can use the **Database Client** extension in VSCode to view the tables and query the data
- to stop the container use `docker compose down`

## Init DB
- create a virtual environment using the `venv-setup.sh` script
- activate the venv using `source` (see the output of the previous script)
- to initialize the db, run the `database/init_db.py` script

## Seed DB
- run the `database/seed_db.py` script to insert a compact dev dataset
- the seed creates 5 users (1 admin), minimal sessions for all statuses, and a small set of trades covering BUY/SELL
- rerunning the seed replaces only previously seeded users (firebase_uid prefixed with `seed_`) and their related sessions/trades
