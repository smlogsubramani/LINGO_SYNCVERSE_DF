import './App.css'
import {getDatabase,ref, set} from 'firebase/database'
import {app} from "./firebase"

const db = getDatabase(app);

function App() {

  const Putdata =()=>{
 set(ref(db,"project/rpa"),{
  id:1,
  name:"rpa",
  assignedto:"shree",
 });
  };
  return (
    <>
      <h1 className='bg-blue'>Hello UIAP</h1>
      <button onClick={Putdata}>Enter the Data</button>
    </>
  )
}

export default App