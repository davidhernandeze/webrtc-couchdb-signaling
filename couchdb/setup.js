import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const client = axios.create({
  auth: {
    username: process.env.COUCHDB_USER,
    password: process.env.COUCHDB_PASSWORD
  },
  baseURL: process.env.COUCHDB_SERVER
})

client.put('_users').then(() => {
  console.log('_users database created')
}).catch((e) => {
  console.log(e.response?.data?.reason)
})

client.put('signaling').then(async () => {
  console.log('signaling database created')
  await client.put('signaling/_security', {
    admins: {
      names: [],
      roles: ['admins']
    },
    members: {
      names: [],
      roles: []
    }
  })
  console.log('signaling is now a public database')
}).catch((e) => {
  console.log(e.response?.data?.reason)
})
