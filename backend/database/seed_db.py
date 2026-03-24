from datetime import datetime, timedelta
from decimal import Decimal
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from database.models import (
    db,
    Session,
    SessionStatus,
    Trade,
    TradeType,
    User,
    UserRole,
)


def _dt(hours_ago: int) -> datetime:
    return datetime.utcnow() - timedelta(hours=hours_ago)


def seed_db() -> None:
    app = create_app()

    with app.app_context():
        db.create_all()

        users_data = [
            {
                "firebase_uid": "seed_admin_001",
                "api_key": "alpaca_api_admin_seed",
                "alpaca_secret": "alpaca_secret_admin_seed",
                "wallet": Decimal("15000.00"),
                "role": UserRole.ADMIN,
            },
            {
                "firebase_uid": "seed_user_001",
                "api_key": "alpaca_api_user1_seed",
                "alpaca_secret": "alpaca_secret_user1_seed",
                "wallet": Decimal("2500.75"),
                "role": UserRole.USER,
            },
            {
                "firebase_uid": "seed_user_002",
                "api_key": None,
                "alpaca_secret": None,
                "wallet": Decimal("0.00"),
                "role": UserRole.USER,
            },
            {
                "firebase_uid": "seed_user_003",
                "api_key": "alpaca_api_user3_seed",
                "alpaca_secret": "alpaca_secret_user3_seed",
                "wallet": Decimal("500.00"),
                "role": UserRole.USER,
            },
            {
                "firebase_uid": "seed_user_004",
                "api_key": None,
                "alpaca_secret": None,
                "wallet": Decimal("120.50"),
                "role": UserRole.USER,
            },
        ]

        seed_uids = [user_data["firebase_uid"] for user_data in users_data]
        existing_seed_users = User.query.filter(User.firebase_uid.in_(seed_uids)).all()

        if existing_seed_users:
            # Delete via ORM so SQLAlchemy cascades deletes to sessions and trades.
            for u in existing_seed_users:
                db.session.delete(u)
            db.session.commit()

        users_by_uid = {}
        for user_data in users_data:
            user = User(**user_data)
            db.session.add(user)
            users_by_uid[user_data["firebase_uid"]] = user

        db.session.flush()

        sessions = [
            Session(
                user_id=users_by_uid["seed_admin_001"].id,
                start_timestamp=_dt(12),
                stop_timestamp=None,
                pnl=None,
                status=SessionStatus.ACTIVE,
            ),
            Session(
                user_id=users_by_uid["seed_user_001"].id,
                start_timestamp=_dt(30),
                stop_timestamp=_dt(24),
                pnl=Decimal("110.80"),
                status=SessionStatus.COMPLETED,
            ),
            Session(
                user_id=users_by_uid["seed_user_002"].id,
                start_timestamp=_dt(20),
                stop_timestamp=_dt(18),
                pnl=Decimal("-15.40"),
                status=SessionStatus.STOPPED,
            ),
            Session(
                user_id=users_by_uid["seed_user_003"].id,
                start_timestamp=_dt(10),
                stop_timestamp=_dt(9),
                pnl=Decimal("-42.10"),
                status=SessionStatus.FAILED,
            ),
            Session(
                user_id=users_by_uid["seed_user_004"].id,
                start_timestamp=_dt(6),
                stop_timestamp=None,
                pnl=None,
                status=SessionStatus.ACTIVE,
            ),
            Session(
                user_id=users_by_uid["seed_user_001"].id,
                start_timestamp=_dt(72),
                stop_timestamp=_dt(70),
                pnl=Decimal("5.00"),
                status=SessionStatus.COMPLETED,
            ),
            Session(
                user_id=users_by_uid["seed_user_001"].id,
                start_timestamp=_dt(48),
                stop_timestamp=_dt(46),
                pnl=Decimal("-2.25"),
                status=SessionStatus.STOPPED,
            ),
        ]

        db.session.add_all(sessions)
        db.session.flush()

        trades = [
            Trade(
                session_id=sessions[0].id,
                price=Decimal("501.25"),
                quantity=Decimal("2.00"),
                type=TradeType.BUY,
                timestamp=_dt(11),
            ),
            Trade(
                session_id=sessions[1].id,
                price=Decimal("498.10"),
                quantity=Decimal("1.00"),
                type=TradeType.BUY,
                timestamp=_dt(29),
            ),
            Trade(
                session_id=sessions[1].id,
                price=Decimal("511.40"),
                quantity=Decimal("1.00"),
                type=TradeType.SELL,
                timestamp=_dt(25),
            ),
            Trade(
                session_id=sessions[2].id,
                price=Decimal("505.90"),
                quantity=Decimal("0.50"),
                type=TradeType.BUY,
                timestamp=_dt(19),
            ),
            Trade(
                session_id=sessions[3].id,
                price=Decimal("492.00"),
                quantity=Decimal("0.75"),
                type=TradeType.SELL,
                timestamp=_dt(9),
            ),
            Trade(
                session_id=sessions[5].id,
                price=Decimal("499.00"),
                quantity=Decimal("0.25"),
                type=TradeType.BUY,
                timestamp=_dt(71),
            ),
            Trade(
                session_id=sessions[5].id,
                price=Decimal("503.50"),
                quantity=Decimal("0.75"),
                type=TradeType.SELL,
                timestamp=_dt(70),
            ),
            Trade(
                session_id=sessions[5].id,
                price=Decimal("500.10"),
                quantity=Decimal("0.10"),
                type=TradeType.BUY,
                timestamp=_dt(71),
            ),
            Trade(
                session_id=sessions[5].id,
                price=Decimal("502.00"),
                quantity=Decimal("0.40"),
                type=TradeType.SELL,
                timestamp=_dt(70),
            ),
            Trade(
                session_id=sessions[5].id,
                price=Decimal("501.75"),
                quantity=Decimal("0.65"),
                type=TradeType.BUY,
                timestamp=_dt(70),
            ),
        ]

        db.session.add_all(trades)
        db.session.commit()

        print("Seed completed successfully.")
        print("Users: 5 (1 admin + 4 regular)")
        print("Sessions: 7 (covers ACTIVE, COMPLETED, STOPPED, FAILED; user_001 has multiple sessions)")
        print("Trades: 10 (covers BUY and SELL with sparse data; one user session has multiple trades)")


if __name__ == "__main__":
    seed_db()
    