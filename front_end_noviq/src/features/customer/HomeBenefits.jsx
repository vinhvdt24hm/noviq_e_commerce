import { CreditCard, ShieldCheck, Truck } from 'lucide-react'

const benefits = [
  {
    title: 'Giao hàng tiện lợi',
    description: 'Theo dõi đơn hàng dễ dàng',
    label: 'GIAO HÀNG',
    icon: Truck,
    tone: 'delivery',
  },
  {
    title: 'Mua sắm an tâm',
    description: 'Thông tin sản phẩm rõ ràng',
    label: 'TIN CẬY',
    icon: ShieldCheck,
    tone: 'trust',
  },
  {
    title: 'Thanh toán khi nhận hàng',
    description: 'COD linh hoạt, dễ dàng',
    label: 'THANH TOÁN',
    icon: CreditCard,
    tone: 'payment',
  },
]

export default function HomeBenefits() {
  return (
    <section
      className="home-benefits"
      aria-label="Lợi ích khi mua sắm tại NOVIQ"
    >
      {benefits.map(({ title, description, label, icon: Icon, tone }) => (
        <article className={`home-benefit home-benefit--${tone}`} key={title}>
          <span className="home-benefit__icon" aria-hidden="true">
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="home-benefit__content">
            <span className="home-benefit__label">{label}</span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </article>
      ))}
    </section>
  )
}
