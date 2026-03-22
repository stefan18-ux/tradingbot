from flask import Flask, jsonify
from dotenv import load_dotenv
import os
from backend.database.models import db
from backend.routes.users import users_bp
from flask_migrate import Migrate

load_dotenv()

migrate = Migrate()


def create_app():
    app = Flask(__name__, instance_relative_config=False)

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL', 'mysql+pymysql://user:password@127.0.0.1:3306/tradingbot'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)
    
    app.register_blueprint(users_bp)

    @app.route('/health')
    def health():
        return jsonify({'status': 'ok'})

    return app

if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=5000, debug=True)
