<template>
  <div class="fixed right-0 top-0 p-3">
    <span
      v-if="isConnected"
      class="text-green-500"
    >Connected</span>
    <span
      v-else
      class="text-gray-400"
    >Disconnected</span>
  </div>
  <div class="text-gray-100 relative flex-1 container max-w-2xl mx-auto px-4 pt-10">
    <div v-if="!isConnected">
      <h1 class="text-xl mb-10">
        WebRTC Peer Connection using a CouchDB server for signaling
      </h1>
      <div v-if="!connectionMode">
        <button
          class="bg-green-700 p-2 rounded"
          @click="initConnection"
        >
          Create Connection
        </button>
        <button
          class="bg-blue-800 p-2 rounded ml-4"
          @click="connectionMode = 'join'"
        >
          Join Connection
        </button>
      </div>
      <div v-if="connectionMode === 'host'">
        <div class="mt-4">
          Your connection ID (click to copy)
        </div>
        <div
          class="text-4xl cursor-pointer"
          @click="idToClipboard"
        >
          {{ connectionId }}
        </div>
        <div
          v-show="showCopiedLabel"
          class="text-xs text-green-500 uppercase font-bold mt-2"
        >
          ID COPIED!
        </div>
      </div>
      <div v-else-if="connectionMode === 'join'">
        <div class="mt-4">
          Introduce your connection code:
        </div>
        <div class="flex flex-wrap items-center">
          <input
            v-model="connectionId"
            class="text-2xl w-full sm:w-auto mb-4 sm:mb-0 bg-transparent p-4 text-center border-2"
            maxlength="5"
          >
          <button
            class="w-full sm:w-auto bg-transparent border text-green-500 border-green-500 h-full ml-0 sm:ml-3 p-4 rounded"
            @click="joinConnection"
          >
            CONNECT
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      class="mt-8"
    >
      <div
        ref="chatContainer"
        class="bg-gray-700 w-full h-96 overflow-y-scroll p-5 rounded flex-row"
      >
        <div
          v-for="{ id, message, isLocal } in messages"
          :key="id"
          class="w-full flex"
          :class="isLocal ? 'justify-end' : 'justify-start'"
        >
          <div
            class="bg-blue-600 my-1 w-max py-2 px-4 max-w-md rounded-xl break-words"
          >
            {{ message }}
          </div>
        </div>
      </div>
      <div class="flex mt-4">
        <input
          v-model="newMessage"
          class="bg-transparent flex-1 border border-gray-100 px-2"
          @keyup.enter="sendMessage"
        >
        <button
          class="bg-green-700 py-2 px-4 rounded ml-4"
          @click="sendMessage"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeMount, ref } from 'vue'
import PouchDB from 'pouchdb-browser'
import { v4 as getId } from 'uuid'

const signalingServerURL = import.meta.env.VITE_COUCHDB_SERVER
const signalingDocument = ref()
const connectionId = ref()
const connectionMode = ref()
const isConnected = ref(false)

const signalingDatabase = new PouchDB(signalingServerURL + 'signaling')

onBeforeMount(async () => {
  await signalingDatabase.info()
  console.log('Signaling database connected')
})

const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80'
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
})

async function initConnection () {
  connectionMode.value = 'host'

  const newConnectionId = getId().substring(0, 5).toUpperCase()
  await signalingDatabase.put({
    _id: newConnectionId,
    host_description: '',
    host_candidates: [],
    remote_description: '',
    remote_candidates: []
  })
  signalingDocument.value = await signalingDatabase.get(newConnectionId)

  peerConnection.onicecandidate = async e => {
    if (e.candidate) {
      signalingDocument.value.host_candidates.push(JSON.stringify(e.candidate))
      return
    }

    signalingDocument.value.host_description = JSON.stringify(peerConnection.localDescription)
    await signalingDatabase.put(signalingDocument.value)
    connectionId.value = newConnectionId
    signalingDatabase.changes({
      live: true,
      since: 'now',
      include_docs: true,
      doc_ids: [connectionId.value]
    }).on('change', async (change) => {
      if (change.deleted) return
      if (change.doc.remote_candidates.length === 0) return
      for (const candidate of change.doc.remote_candidates) {
        await peerConnection.addIceCandidate(JSON.parse(candidate))
      }
      await peerConnection.setRemoteDescription(JSON.parse(change.doc.remote_description))
      signalingDocument.value = change.doc
    })
  }

  const dataChannel = peerConnection.createDataChannel('main')
  peerConnection.dc = dataChannel
  dataChannel.onmessage = (e) => {
    messages.value.push({ id: getId(), isLocal: false, message: e.data })
  }

  dataChannel.onopen = async () => {
    isConnected.value = true
    await signalingDatabase.remove(signalingDocument.value)
    signalingDatabase.close()
  }

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
}

async function joinConnection () {
  signalingDocument.value = await signalingDatabase.get(connectionId.value)

  peerConnection.onicecandidate = async e => {
    if (e.candidate) {
      signalingDocument.value.remote_candidates.push(JSON.stringify(peerConnection.localDescription))
      return
    }
    signalingDocument.value.remote_description = JSON.stringify(peerConnection.localDescription)
    await signalingDatabase.put(signalingDocument.value)
  }
  peerConnection.ondatachannel = ({ channel }) => {
    peerConnection.dc = channel
    peerConnection.dc.onopen = () => {
      isConnected.value = true
    }
    peerConnection.dc.onmessage = e => {
      messages.value.push({ id: getId(), isLocal: false, message: e.data })
    }
  }

  await peerConnection.setRemoteDescription(JSON.parse(signalingDocument.value.host_description))
  for (const candidate of signalingDocument.value.host_candidates) {
    await peerConnection.addIceCandidate(JSON.parse(candidate))
  }
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
}

const newMessage = ref()
const messages = ref([])
const chatContainer = ref()
async function sendMessage () {
  messages.value.push({ id: getId(), isLocal: true, message: newMessage.value })
  peerConnection.dc.send(newMessage.value)
  newMessage.value = ''
  await nextTick()
  chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}

const showCopiedLabel = ref(false)
async function idToClipboard () {
  await navigator.clipboard.writeText(connectionId.value)
  showCopiedLabel.value = true
  setTimeout(() => {
    showCopiedLabel.value = false
  }, 1000)
}

</script>
