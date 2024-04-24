import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import "./css/Product.css";
import Rating from "./Rating";
import axios from "axios";
import { Store } from "../Store";

function Food(props) {
  const { food } = props;
  const { state, dispatch: ctxDispatch } = useContext(Store);
  const {
    cart: { cartItems },
  } = state;

  const [loading, setLoading] = useState(true);

  //delayed loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const addToCartHandler = async (item) => {
    const existItem = cartItems.find((x) => x._id === food._id);
    const quantity = existItem ? existItem.quantity + 1 : 1;
    const { data } = await axios.get(`api/foods/${item._id}`);
    if (data.countInStock < quantity) {
      // Check quantity
      window.alert("Foods out of stock");
      return;
    }

    ctxDispatch({
      type: "CART_ADD_ITEM",
      payload: { ...item, quantity },
    });
  };

  return (
    <div style={{ paddingRight: "2vw", paddingTop: "2vw" }}>
      {loading ? (
        <div className="loading-box" />
      ) : (
        <Card className="mb-3 card-container appear-animation">
          <Link to={`/food/${food.slug}`}>
            <img
              style={{ maxWidth: "100%" }}
              src={food.img}
              className="food-size"
              alt={food.name}
            />
          </Link>
          <Card.Body>
            <Link to={`/food/${food.slug}`}>
              <Card.Title>
                <p className="food-title">{food.name}</p>
              </Card.Title>
            </Link>

            <Rating rating={food.rating} numReviews={food.numReviews} />
            <Card.Text>
              <strong>Type: {food.category}</strong>
            </Card.Text>
            <Card.Text>
              <strong>Sold: {food.sold}</strong>
            </Card.Text>
            <Card.Text>
              <strong>${food.price}</strong>
            </Card.Text>
            {food.countInStock === 0 ? (
              <Button
                style={{
                  borderColor: "black",
                  fontSize: "large",
                  borderRadius: "10px",
                }}
                variant="light"
                disabled
              >
                Out of Stock
              </Button>
            ) : (
              <Button
                variant="success"
                onClick={() => addToCartHandler(food)}
              >
                <div className="fas fa-cart-plus"></div> Add to Cart
              </Button>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default Food;
