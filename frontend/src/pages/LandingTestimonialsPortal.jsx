import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Star, UserRound } from 'lucide-react';
import './LandingTestimonials.css';

const testimonials = [
  {
    name: 'Юра',
    business: 'СТО',
    location: 'Київ',
    rating: 5,
    text: 'Чудова програма, яка ідеально закриває всі потреби СТО. Впровадили VIN-matrix кілька тижнів тому і вже бачимо помітний приріст у продуктивності майстрів та менеджерів. Техпідтримка та функціонал — на найвищому рівні!',
  },
];

function Testimonials() {
  return <section className="vft-testimonials" aria-labelledby="vft-title">
    <div className="vft-heading">
      <span className="vf-eyebrow"><i /> ВІДГУКИ КЛІЄНТІВ</span>
      <h2 id="vft-title">Коли система справді полегшує щоденну роботу.</h2>
      <p>Реальний досвід тих, хто вже використовує VIN-matrix у своєму сервісі.</p>
    </div>
    <div className="vft-grid">
      {testimonials.map((testimonial) => <article key={`${testimonial.name}-${testimonial.location}`}>
        <div className="vft-rating" aria-label={`Оцінка ${testimonial.rating} з 5`}>
          {Array.from({ length: testimonial.rating }, (_, index) => <Star key={index} size={16} fill="currentColor" />)}
          <b>{testimonial.rating}.0</b>
        </div>
        <blockquote>“{testimonial.text}”</blockquote>
        <footer>
          <span className="vft-avatar" aria-label={`Аватар ${testimonial.name}`}><UserRound size={22} strokeWidth={2.2} /></span>
          <div>
            <b>{testimonial.name}</b>
            <span>{testimonial.business} <i>•</i> <MapPin size={12} /> {testimonial.location}</span>
          </div>
        </footer>
      </article>)}
    </div>
  </section>;
}

export default function LandingTestimonialsPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const footer = document.querySelector('.vf-footer');
    if (!footer || !footer.parentElement) return undefined;
    let host = document.getElementById('vft-testimonials-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vft-testimonials-host';
      footer.parentElement.insertBefore(host, footer);
    }
    setTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  return target ? createPortal(<Testimonials />, target) : null;
}
