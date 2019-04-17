# user-service
Serverless CRUD service exposing a REST HTTP interface for users

Running Locally
- `npm i`
- Copy `serverless.env.example.yml` and create file `serverless.env.yml`
- Run `npm start` (runs serverless offline)
- Hit endpoints using postman collection

Deploy
- set your local .aws credentials to the correct keys
- deploy to dev: `npm run deploy-dev`
- deploy to prod: `npm run deploy-prod`
