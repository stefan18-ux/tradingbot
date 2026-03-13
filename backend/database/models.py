from datetime import datetime
import enum
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Numeric

db = SQLAlchemy()


class ActionType(enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class UserRole(enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    firebase_token = db.Column(db.String(255), nullable=False)
    api_key = db.Column(db.String(255), nullable=True, unique=True)
    wallet = db.Column(Numeric(18, 8), nullable=False, default=0)
    role = db.Column(db.Enum(UserRole, name='user_role'), nullable=False, default=UserRole.USER)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=db.func.now(), onupdate=db.func.now())

    sessions = db.relationship('Session', back_populates='user', cascade='all, delete-orphan')


class Session(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    start_timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    stop_timestamp = db.Column(db.DateTime, nullable=True)
    pnl = db.Column(Numeric(18, 8), nullable=True)

    user = db.relationship('User', back_populates='sessions')
    actions = db.relationship('Action', back_populates='session', cascade='all, delete-orphan', order_by='Action.timestamp')


class Action(db.Model):
    __tablename__ = 'actions'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False, index=True)
    sum = db.Column(Numeric(18, 8), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    type = db.Column(db.Enum(ActionType, name='action_type'), nullable=False)

    session = db.relationship('Session', back_populates='actions')
