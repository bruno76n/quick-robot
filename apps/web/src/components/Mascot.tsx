import mascot from '../styles/mascot.svg';

/** The product mascot (assets/mascot-r1.svg). The business name next to it comes from Ajustes (D30). */
export function Mascot({ size = 40 }: { size?: number }) {
  return <img className="mascot" src={mascot} width={size} height={Math.round((size * 106) / 120)} alt="" />;
}
