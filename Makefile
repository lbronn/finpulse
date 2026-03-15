.PHONY: dev-frontend dev-backend dev install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && pip install -r requirements.txt

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && source .venv/bin/activate && python manage.py runserver 8000

dev:
	$(MAKE) dev-frontend & $(MAKE) dev-backend
