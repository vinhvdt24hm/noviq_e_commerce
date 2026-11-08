import { useEffect, useRef, useState } from 'react'
import { Headphones, MessageCircle, Send, X } from 'lucide-react'

const quickQuestions = [
  'Cách đặt hàng?',
  'Phương thức thanh toán?',
  'Theo dõi đơn hàng?',
]

function getAutoReply(message) {
  const query = message.toLocaleLowerCase('vi')

  if (query.includes('đặt hàng') || query.includes('mua hàng')) {
    return 'Bạn chọn sản phẩm, thêm vào giỏ hàng rồi chọn “Tiến hành đặt hàng”. Hiện website hỗ trợ thanh toán khi nhận hàng (COD).'
  }
  if (query.includes('thanh toán') || query.includes('cod') || query.includes('trả tiền')) {
    return 'Hiện NOVIQ hỗ trợ thanh toán khi nhận hàng (COD). Cổng thanh toán trực tuyến chưa được kết nối.'
  }
  if (query.includes('theo dõi') || query.includes('đơn hàng') || query.includes('vận chuyển')) {
    return 'Bạn có thể đăng nhập tài khoản khách hàng và chọn “Theo dõi đơn hàng” ở đầu trang để xem trạng thái đơn.'
  }
  if (query.includes('đổi trả') || query.includes('hoàn tiền') || query.includes('trả hàng')) {
    return 'Để được hỗ trợ về đổi trả, vui lòng liên hệ support@noviq.example hoặc hotline 1900 0000.'
  }
  if (query.includes('sản phẩm') || query.includes('tồn kho') || query.includes('còn hàng')) {
    return 'Bạn có thể xem giá, mô tả và số lượng còn hàng ngay trên trang chi tiết của từng sản phẩm.'
  }
  return 'Mình chưa tìm thấy câu trả lời phù hợp. Bạn vui lòng liên hệ support@noviq.example hoặc hotline 1900 0000 để được hỗ trợ thêm.'
}

function createMessage(sender, text) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    sender,
    text,
    createdAt: new Date(),
  }
}

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [messages, setMessages] = useState([
    createMessage(
      'bot',
      'Xin chào! Mình là trợ lý tự động NOVIQ. Bạn cần hỗ trợ điều gì?',
    ),
  ])
  const replyTimer = useRef(null)
  const messageListRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      messageListRef.current?.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth',
      })
      inputRef.current?.focus()
    }
  }, [isOpen, isReplying, messages])

  useEffect(() => () => window.clearTimeout(replyTimer.current), [])

  function sendMessage(text) {
    const message = text.trim()
    if (!message || isReplying) return

    setMessages((current) => [...current, createMessage('customer', message)])
    setDraft('')
    setIsReplying(true)
    window.clearTimeout(replyTimer.current)
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        createMessage('bot', getAutoReply(message)),
      ])
      setIsReplying(false)
    }, 450)
  }

  function submitMessage(event) {
    event.preventDefault()
    sendMessage(draft)
  }

  return (
    <div className="support-chat-widget">
      {isOpen && (
        <section
          className="support-chat-panel"
          aria-label="Chat hỗ trợ NOVIQ"
          aria-live="polite"
        >
          <header className="support-chat-header">
            <span className="support-chat-avatar"><Headphones size={20} /></span>
            <div className="support-chat-heading">
              <strong>Hỗ trợ NOVIQ</strong>
              <small>Trợ lý tự động</small>
            </div>
            <button
              className="support-chat-close"
              type="button"
              aria-label="Đóng chat hỗ trợ"
              onClick={() => setIsOpen(false)}
            >
              <X size={20} />
            </button>
          </header>

          <div className="support-chat-messages" ref={messageListRef}>
            <p className="support-chat-notice">
              Câu trả lời tự động · Không lưu nội dung hội thoại
            </p>
            {messages.map((message) => (
              <article
                className={`support-chat-message ${message.sender}`}
                key={message.id}
              >
                <p>{message.text}</p>
                <time>
                  {message.createdAt.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </article>
            ))}
            {messages.length === 1 && !isReplying && (
              <div className="support-chat-quick-questions">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            {isReplying && (
              <p className="support-chat-typing" role="status">Trợ lý đang trả lời...</p>
            )}
          </div>

          <form className="support-chat-form" onSubmit={submitMessage}>
            <input
              ref={inputRef}
              aria-label="Nhập nội dung cần hỗ trợ"
              maxLength={500}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
            />
            <button
              type="submit"
              aria-label="Gửi tin nhắn"
              disabled={!draft.trim() || isReplying}
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      )}

      <button
        className={`support-chat-launcher${isOpen ? ' is-open' : ''}`}
        type="button"
        aria-label={isOpen ? 'Đóng chat hỗ trợ' : 'Mở chat hỗ trợ'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        <span>{isOpen ? 'Đóng' : 'Hỗ trợ'}</span>
      </button>
    </div>
  )
}
