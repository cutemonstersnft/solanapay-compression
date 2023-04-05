import BackLink from '../components/BackLink';
import Confirmed from '../components/Confirmed';
import PageHeading from '../components/PageHeading';

export default function ConfirmedPage() {
  return (
    <div className='flex flex-col items-center gap-8'>
      <div className="mt-8"></div>
      <PageHeading>Transaction Success: Funds Sent!</PageHeading>
      <div className='h-80 w-80'><Confirmed /></div>
    </div>
  )
}
