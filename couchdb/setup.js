import axios from 'axios'

const client = axios.create({
  auth: {
    username: 'admin',
    password: 'password'
  },
  baseURL: 'http://localhost:5984/'
})

client.put('_users').then(() => {
  console.log('_users database created')
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
})
