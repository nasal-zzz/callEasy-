import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createWorker } from 'tesseract.js'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const STATUS_OPTIONS = [
  'Connected',
  'Switchoff',
  'No Incoming Calls',
  'No Answered',
]

function normalizeNumber(raw) {
  if (!raw) return null
  const digits = raw.replace(/[^+\d]/g, '')
  // simple normalization: keep leading + if present
  if (digits.length < 7) return null
  return digits
}

function extractNumbersFromText(text) {
  if (!text) return []
  const re = /(?:\+?\d[\d\-().\s]{5,}\d)/g
  const matches = text.match(re) || []
  const normalized = matches
    .map((m) => normalizeNumber(m))
    .filter(Boolean)
  // unique
  return Array.from(new Set(normalized))
}

export default function App() {
  const [rows, setRows] = useState([]) // {id, number, source, status}
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('calleasy_rows')
    if (saved) setRows(JSON.parse(saved))
  }, [])
  useEffect(() => {
    localStorage.setItem('calleasy_rows', JSON.stringify(rows))
  }, [rows])

  async function handleFiles(files) {
    setLoading(true)
    const arr = Array.from(files)
    for (const file of arr) {
      try {
        await processFile(file)
      } catch (e) {
        console.error('Failed processing', file.name, e)
      }
    }
    setLoading(false)
  }

  async function processFile(file) {
    const name = file.name || 'unknown'
    const ext = name.split('.').pop().toLowerCase()
    let text = ''

    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      text = await parseExcelOrCsv(file)
    } else if (ext === 'pdf') {
      text = await parsePdf(file)
    } else if (ext === 'docx') {
      text = await parseDocx(file)
    } else if (['png', 'jpg', 'jpeg', 'bmp'].includes(ext)) {
      text = await parseImage(file)
    } else if (ext === 'txt') {
      text = await file.text()
    } else {
      // try to read as text fallback
      try {
        text = await file.text()
      } catch (e) {
        text = ''
      }
    }

    const numbers = extractNumbersFromText(text)
    if (numbers.length === 0) return

    setRows((r) => {
      const next = [...r]
      for (const n of numbers) {
        if (!next.some((x) => x.number === n)) {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            number: n,
            source: name,
            status: '—',
            addedAt: new Date().toISOString(),
          })
        }
      }
      return next
    })
  }

  async function parseExcelOrCsv(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target.result
          const workbook = XLSX.read(data, { type: 'binary' })
          let text = ''
          workbook.SheetNames.forEach((name) => {
            const sheet = workbook.Sheets[name]
            const csv = XLSX.utils.sheet_to_csv(sheet)
            text += '\n' + csv
          })
          res(text)
        } catch (err) {
          rej(err)
        }
      }
      reader.onerror = rej
      reader.readAsBinaryString(file)
    })
  }

  async function parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const strings = content.items.map((s) => s.str)
      fullText += '\n' + strings.join(' ')
    }
    return fullText
  }

  async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  async function parseImage(file) {
    const worker = await createWorker({ logger: () => {} })
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')
    const { data } = await worker.recognize(file)
    await worker.terminate()
    return data.text
  }

  function handleStatusChange(id, newStatus) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
  }

  function handleDelete(id) {
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  const visible = rows.filter((r) => {
    if (filterStatus !== 'All' && r.status !== filterStatus) return false
    if (!search) return true
    return (
      r.number.toLowerCase().includes(search.toLowerCase()) ||
      (r.source || '').toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="app">
      <header>
        <h1>callEasy</h1>
        <p>Upload files (Excel, PDF, DOCX, images, text). Click a number to open the phone dialer.</p>
      </header>

      <section className="controls">
        <div className="left">
          <input
            id="file"
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            accept=".xlsx,.xls,.csv,.pdf,.docx,.txt,.png,.jpg,.jpeg,.bmp"
          />
          {loading && <span className="loading">Processing...</span>}
        </div>
        <div className="right">
          <input
            placeholder="Search number or source"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button onClick={() => { setRows([]); localStorage.removeItem('calleasy_rows') }}>Clear</button>
        </div>
      </section>

      <section className="table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Number</th>
              <th>Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>
                  <a href={`tel:${r.number}`}>{r.number}</a>
                </td>
                <td>{r.source}</td>
                <td>
                  <select value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value)}>
                    <option>—</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button onClick={() => handleDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5}>No numbers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer>
        <p>Note: Clicking a number uses a tel: link to open the device dialer. The app cannot write to a phone's call log.</p>
      </footer>
    </div>
  )
}
