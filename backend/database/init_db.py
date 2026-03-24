from app import create_app
from database.models import db


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print('Database initialized (created tables from models)')


if __name__ == '__main__':
    init_db()
