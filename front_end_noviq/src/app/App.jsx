import CustomerApp from "../features/customer/CustomerApp";
import SellerApp from "../features/seller/SellerApp";

function App() {
  if (window.location.pathname.startsWith("/seller")) {
    return <SellerApp />;
  }

  return <CustomerApp />;
}

export default App;
