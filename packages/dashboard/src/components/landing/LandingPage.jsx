import LandingMorphism from './variants/LandingMorphism';

export default function LandingPage(props) {
  return (
    <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden">
      <LandingMorphism {...props} />
    </div>
  );
}
