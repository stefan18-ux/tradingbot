import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from database.models import db


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print('Database initialized (created tables from models)')


if __name__ == '__main__':
    init_db()
